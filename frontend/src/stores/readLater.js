import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { linksApi } from '../api'

const PAGE_SIZE = 12

// Selections are persisted per user and per filter tab, so a refresh or
// re-entering the page restores exactly the ids picked on that screen.
const PREFIX = 'readLaterSelected'
function selectionStorageKey(status) {
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  const userId = user?.id ?? 'anonymous'
  return `${PREFIX}:${userId}:${status}`
}

function loadSelection(status) {
  try {
    const raw = localStorage.getItem(selectionStorageKey(status))
    const ids = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(ids) ? ids.filter(Number.isInteger) : [])
  } catch {
    return new Set()
  }
}

function persistSelection(status, ids) {
  try {
    localStorage.setItem(selectionStorageKey(status), JSON.stringify([...ids]))
  } catch {
    // Storage may be unavailable; selection then only lives in memory.
  }
}

export const useReadLaterStore = defineStore('readLater', () => {
  const links = ref([])
  const total = ref(0)
  const currentPage = ref(1)
  const totalPages = ref(1)
  const loading = ref(false)
  const batchLoading = ref(false)
  const stats = ref({
    pending: 0,
    completed: 0,
    skipped: 0,
    total: 0,
  })

  const filterStatus = ref('pending')

  // Selected ids, keyed by filter tab so switching tabs keeps each
  // screen's own selection. Survives refresh / app restart via localStorage.
  // Whether a persisted id is still processable is enforced server-side by
  // scope_status, so an id that changed during the break is rejected instead
  // of processed a second time, and pruned from the selection afterwards.
  const selectedByStatus = ref({
    all: new Set(),
    pending: new Set(),
    completed: new Set(),
    skipped: new Set(),
  })

  const selectedIds = computed(() => selectedByStatus.value[filterStatus.value] || new Set())

  const selectedCount = computed(() => selectedIds.value.size)

  async function fetchReadLater(page = 1, status = filterStatus.value) {
    loading.value = true
    try {
      const response = await linksApi.getReadLater({
        page,
        limit: PAGE_SIZE,
        status,
      })

      // The batch may shrink the list; avoid landing on an empty page.
      let data = response.data
      if (data.links.length === 0 && data.page > 1) {
        const retry = await linksApi.getReadLater({
          page: 1,
          limit: PAGE_SIZE,
          status,
        })
        data = retry.data
      }

      links.value = data.links
      total.value = data.total
      currentPage.value = data.page
      totalPages.value = data.totalPages
      stats.value = data.stats
      filterStatus.value = status
      return data
    } catch (error) {
      console.error('Failed to fetch read later list:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  function toggleSelected(id) {
    const bucket = selectedByStatus.value[filterStatus.value]
    if (bucket.has(id)) {
      bucket.delete(id)
    } else {
      bucket.add(id)
    }
    persistSelection(filterStatus.value, bucket)
  }

  function setPageSelection(ids, selected) {
    const bucket = selectedByStatus.value[filterStatus.value]
    ids.forEach((id) => {
      if (selected) bucket.add(id)
      else bucket.delete(id)
    })
    persistSelection(filterStatus.value, bucket)
  }

  function clearSelection(status = filterStatus.value) {
    selectedByStatus.value[status] = new Set()
    persistSelection(status, selectedByStatus.value[status])
  }

  async function addToReadLater(linkId, reviewDate = null) {
    const response = await linksApi.addToReadLater(linkId, reviewDate)
    await fetchReadLater(currentPage.value)
    return response.data
  }

  async function removeFromReadLater(linkId) {
    await linksApi.removeFromReadLater(linkId)
    const bucket = selectedByStatus.value[filterStatus.value]
    bucket.delete(linkId)
    persistSelection(filterStatus.value, bucket)
    await fetchReadLater(currentPage.value)
  }

  async function updateReviewStatus(linkId, status) {
    const response = await linksApi.updateReviewStatus(linkId, status)
    const bucket = selectedByStatus.value[filterStatus.value]
    bucket.delete(linkId)
    persistSelection(filterStatus.value, bucket)
    await fetchReadLater(currentPage.value)
    return response.data
  }

  // Run a batch operation against the currently selected ids.
  // Returns per-item results; only genuine failures stay selected, ready
  // for retry. Successes and ids that left the scope (already processed on
  // a previous run, or removed) are pruned so they can never run twice.
  async function batchReview(action, payload = {}) {
    const ids = [...selectedIds.value]
    if (ids.length === 0) return null

    batchLoading.value = true
    try {
      const response = await linksApi.batchReview({
        link_ids: ids,
        action,
        scope_status: filterStatus.value,
        ...payload,
      })
      const data = response.data

      if (data.stats) {
        stats.value = data.stats
      }

      // Refresh so the list and counters reflect the applied changes.
      await fetchReadLater(currentPage.value)

      // A 'failed' item passed every scope check but errored while updating,
      // so it is still in range (possibly on another page) and stays picked.
      // Everything else — successes and out-of-scope items from an earlier
      // run — is dropped so it can never be processed a second time.
      const bucket = selectedByStatus.value[filterStatus.value]
      for (const result of data.results || []) {
        bucket.delete(result.id)
        if (!result.success && result.code === 'failed') {
          bucket.add(result.id)
        }
      }
      persistSelection(filterStatus.value, bucket)

      return data
    } finally {
      batchLoading.value = false
    }
  }

  function setFilterStatus(status) {
    filterStatus.value = status
    if (!selectedByStatus.value[status]) {
      selectedByStatus.value[status] = loadSelection(status)
    }
    fetchReadLater(1, status)
  }

  // Restore persisted selections on store creation.
  ;['all', 'pending', 'completed', 'skipped'].forEach((status) => {
    selectedByStatus.value[status] = loadSelection(status)
  })

  return {
    links,
    total,
    currentPage,
    totalPages,
    loading,
    batchLoading,
    stats,
    filterStatus,
    selectedIds,
    selectedCount,
    fetchReadLater,
    addToReadLater,
    removeFromReadLater,
    updateReviewStatus,
    batchReview,
    toggleSelected,
    setPageSelection,
    clearSelection,
    setFilterStatus,
  }
})
