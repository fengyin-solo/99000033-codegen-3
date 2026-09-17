<template>
  <div class="read-later-container">
    <div class="page-header">
      <h1 class="page-title">稍后阅读</h1>
      <p class="page-subtitle">按计划回顾您收藏的链接</p>
    </div>

    <div class="stats-cards">
      <div class="stat-card" :class="{ active: readLaterStore.filterStatus === 'all' }" @click="readLaterStore.setFilterStatus('all')">
        <div class="stat-icon all">
          <el-icon><Document /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ readLaterStore.stats.total }}</div>
          <div class="stat-label">全部</div>
        </div>
      </div>
      <div class="stat-card" :class="{ active: readLaterStore.filterStatus === 'pending' }" @click="readLaterStore.setFilterStatus('pending')">
        <div class="stat-icon pending">
          <el-icon><Clock /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ readLaterStore.stats.pending }}</div>
          <div class="stat-label">待回顾</div>
        </div>
      </div>
      <div class="stat-card" :class="{ active: readLaterStore.filterStatus === 'completed' }" @click="readLaterStore.setFilterStatus('completed')">
        <div class="stat-icon completed">
          <el-icon><CircleCheck /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ readLaterStore.stats.completed }}</div>
          <div class="stat-label">已完成</div>
        </div>
      </div>
      <div class="stat-card" :class="{ active: readLaterStore.filterStatus === 'skipped' }" @click="readLaterStore.setFilterStatus('skipped')">
        <div class="stat-icon skipped">
          <el-icon><CircleClose /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ readLaterStore.stats.skipped }}</div>
          <div class="stat-label">已跳过</div>
        </div>
      </div>
    </div>

    <div class="batch-toolbar">
      <el-checkbox
        :model-value="allPageChecked"
        :indeterminate="pageIndeterminate"
        :disabled="readLaterStore.links.length === 0"
        @change="toggleSelectAllPage"
      >
        全选本屏
      </el-checkbox>
      <span class="selection-count">
        已选 {{ readLaterStore.selectedCount }} 条
        <el-button
          v-if="readLaterStore.selectedCount > 0"
          link
          type="primary"
          size="small"
          @click="readLaterStore.clearSelection()"
        >
          清除选择
        </el-button>
      </span>
      <div class="batch-actions">
        <el-button
          size="small"
          :disabled="readLaterStore.selectedCount === 0"
          :loading="readLaterStore.batchLoading"
          @click="openBatchDateDialog"
        >
          改回顾日期
        </el-button>
        <el-button
          size="small"
          :disabled="readLaterStore.selectedCount === 0"
          :loading="readLaterStore.batchLoading"
          @click="executeBatch('set_status', { review_status: 'completed' }, '标记为已回顾')"
        >
          标记已回顾
        </el-button>
        <el-button
          size="small"
          :disabled="readLaterStore.selectedCount === 0"
          :loading="readLaterStore.batchLoading"
          @click="executeBatch('set_status', { review_status: 'skipped' }, '标记为已跳过')"
        >
          标记已跳过
        </el-button>
        <el-button
          size="small"
          type="danger"
          plain
          :disabled="readLaterStore.selectedCount === 0"
          :loading="readLaterStore.batchLoading"
          @click="confirmBatchRemove"
        >
          移出稍后阅读
        </el-button>
      </div>
    </div>

    <div v-loading="readLaterStore.loading" class="links-grid">
      <div
        v-for="link in readLaterStore.links"
        :key="link.id"
        class="read-later-card"
        :class="['status-' + link.review_status, { selected: readLaterStore.selectedIds.has(link.id) }]"
        @click="readLaterStore.toggleSelected(link.id)"
      >
        <div class="card-header">
          <div class="card-header-left">
            <el-checkbox
              :model-value="readLaterStore.selectedIds.has(link.id)"
              class="card-checkbox"
              @click.stop
              @change="readLaterStore.toggleSelected(link.id)"
            />
            <div class="status-badge" :class="link.review_status">
              {{ getStatusText(link.review_status) }}
            </div>
          </div>
          <div class="card-actions" @click.stop>
            <el-dropdown @command="(cmd) => handleStatusChange(link, cmd)" trigger="click">
              <el-button size="small" text>
                <el-icon><MoreFilled /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="pending" :disabled="link.review_status === 'pending'">
                    标记为待回顾
                  </el-dropdown-item>
                  <el-dropdown-item command="completed" :disabled="link.review_status === 'completed'">
                    标记为已完成
                  </el-dropdown-item>
                  <el-dropdown-item command="skipped" :disabled="link.review_status === 'skipped'">
                    标记为已跳过
                  </el-dropdown-item>
                  <el-dropdown-item divided command="remove">
                    从稍后阅读移除
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <a :href="link.url" target="_blank" class="card-title" @click.stop>
          {{ link.title }}
        </a>

        <p v-if="link.description" class="card-description">
          {{ link.description }}
        </p>

        <div class="card-meta">
          <div v-if="link.category_name" class="category-tag" :style="{ backgroundColor: link.category_color }">
            {{ link.category_name }}
          </div>
          <div class="tag-list">
            <el-tag v-for="tag in link.tags" :key="tag" size="small" class="tag-item">
              {{ tag }}
            </el-tag>
          </div>
        </div>

        <div class="card-footer">
          <div class="review-date" v-if="link.review_date">
            <el-icon><Calendar /></el-icon>
            <span>计划: {{ formatDate(link.review_date) }}</span>
          </div>
          <div class="review-date" v-else>
            <el-icon><Calendar /></el-icon>
            <span>未设置计划</span>
          </div>
          <el-button size="small" text @click.stop="openScheduleDialog(link)">
            <el-icon><Edit /></el-icon>
            设置计划
          </el-button>
        </div>
      </div>

      <el-empty v-if="!readLaterStore.loading && readLaterStore.links.length === 0" :description="getEmptyDescription()" />
    </div>

    <div class="pagination" v-if="readLaterStore.totalPages > 1">
      <el-pagination
        v-model:current-page="readLaterStore.currentPage"
        :page-size="12"
        :total="readLaterStore.total"
        layout="prev, pager, next"
        @current-change="handlePageChange"
      />
    </div>

    <el-dialog v-model="scheduleDialogVisible" title="设置回顾计划" width="400px">
      <div class="schedule-form">
        <el-form-item label="回顾日期">
          <el-date-picker
            v-model="scheduleDate"
            type="date"
            placeholder="选择回顾日期"
            style="width: 100%"
            :disabled-date="disabledDate"
          />
        </el-form-item>
        <div class="quick-options">
          <el-button size="small" @click="setQuickDate(1)">明天</el-button>
          <el-button size="small" @click="setQuickDate(3)">3天后</el-button>
          <el-button size="small" @click="setQuickDate(7)">1周后</el-button>
          <el-button size="small" @click="setQuickDate(30)">1月后</el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="scheduleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveSchedule">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchDateDialogVisible" title="批量设置回顾日期" width="400px">
      <div class="schedule-form">
        <p class="batch-hint">将为已选的 {{ readLaterStore.selectedCount }} 条链接统一设置回顾日期</p>
        <el-form-item label="回顾日期">
          <el-date-picker
            v-model="batchScheduleDate"
            type="date"
            placeholder="选择回顾日期"
            style="width: 100%"
            :disabled-date="disabledDate"
          />
        </el-form-item>
        <div class="quick-options">
          <el-button size="small" @click="setBatchQuickDate(1)">明天</el-button>
          <el-button size="small" @click="setBatchQuickDate(3)">3天后</el-button>
          <el-button size="small" @click="setBatchQuickDate(7)">1周后</el-button>
          <el-button size="small" @click="setBatchQuickDate(30)">1月后</el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="batchDateDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="readLaterStore.batchLoading"
          @click="saveBatchDate"
        >
          应用到 {{ readLaterStore.selectedCount }} 条
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, h, onMounted } from 'vue'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { Document, Clock, CircleCheck, CircleClose, MoreFilled, Calendar, Edit } from '@element-plus/icons-vue'
import { useReadLaterStore } from '../stores/readLater'
import { linksApi } from '../api'

const readLaterStore = useReadLaterStore()

const scheduleDialogVisible = ref(false)
const scheduleDate = ref(null)
const currentLink = ref(null)

const batchDateDialogVisible = ref(false)
const batchScheduleDate = ref(null)

const pageIds = computed(() => readLaterStore.links.map((l) => l.id))
const allPageChecked = computed(
  () => pageIds.value.length > 0 && pageIds.value.every((id) => readLaterStore.selectedIds.has(id))
)
const pageIndeterminate = computed(() => {
  const checkedOnPage = pageIds.value.filter((id) => readLaterStore.selectedIds.has(id)).length
  return checkedOnPage > 0 && checkedOnPage < pageIds.value.length
})

onMounted(() => {
  readLaterStore.fetchReadLater()
})

function toggleSelectAllPage(checked) {
  readLaterStore.setPageSelection(pageIds.value, checked)
}

function getStatusText(status) {
  const map = {
    pending: '待回顾',
    completed: '已完成',
    skipped: '已跳过',
  }
  return map[status] || status
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function getEmptyDescription() {
  const map = {
    pending: '暂无待回顾的链接',
    completed: '暂无已完成的链接',
    skipped: '暂无已跳过的链接',
    all: '暂无稍后阅读的链接',
  }
  return map[readLaterStore.filterStatus] || '暂无数据'
}

async function handleStatusChange(link, command) {
  if (command === 'remove') {
    try {
      await ElMessageBox.confirm(`确定要将 "${link.title}" 从稍后阅读移除吗？`, '确认移除', {
        type: 'warning',
      })
      await readLaterStore.removeFromReadLater(link.id)
      ElMessage.success('已从稍后阅读移除')
    } catch (err) {
      if (err !== 'cancel') {
        ElMessage.error('操作失败')
      }
    }
  } else {
    await readLaterStore.updateReviewStatus(link.id, command)
    ElMessage.success('状态已更新')
  }
}

function openScheduleDialog(link) {
  currentLink.value = link
  scheduleDate.value = link.review_date ? new Date(link.review_date) : null
  scheduleDialogVisible.value = true
}

function disabledDate(time) {
  return time.getTime() < Date.now() - 86400000
}

function setQuickDate(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  scheduleDate.value = date
}

async function saveSchedule() {
  if (!currentLink.value) return
  
  try {
    await linksApi.updateLink(currentLink.value.id, {
      review_date: scheduleDate.value ? scheduleDate.value.toISOString().split('T')[0] : null,
    })
    await readLaterStore.fetchReadLater(readLaterStore.currentPage)
    scheduleDialogVisible.value = false
    ElMessage.success('计划已更新')
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

function handlePageChange(page) {
  readLaterStore.fetchReadLater(page)
}

const FAILURE_REASONS = {
  not_in_scope: '已不在稍后阅读列表（可能已被移除）',
  out_of_scope: '状态已变化，不在当前范围内',
  failed: '服务端处理失败',
}

// Batch operations report per-item results. Successful ids (and ids that
// already left the scope on a previous run) are pruned from the selection;
// only genuine failures stay checked so the user can retry them directly.
function reportBatchResult(data) {
  const { summary, results } = data
  const failedResults = results.filter((r) => !r.success)
  const realFailures = failedResults.filter((r) => r.code === 'failed')
  const excluded = failedResults.filter((r) => r.code !== 'failed')

  const titleOf = (id) => readLaterStore.links.find((l) => l.id === id)?.title || `#${id}`

  if (summary.succeeded > 0 && failedResults.length === 0) {
    ElMessage.success(`操作完成：成功 ${summary.succeeded} 条`)
    return
  }

  ElNotification({
    title: `批量操作完成：成功 ${summary.succeeded} 条，失败 ${summary.failed} 条`,
    type: realFailures.length > 0 ? 'warning' : 'info',
    duration: 6000,
    message: h('div', { class: 'batch-result' }, [
      h('p', null, `共 ${summary.total} 条：成功 ${summary.succeeded} 条${
        excluded.length > 0 ? `，${excluded.length} 条已不在当前范围` : ''
      }${realFailures.length > 0 ? `，失败 ${realFailures.length} 条（仍保持勾选，可重试）` : ''}`),
      ...failedResults.slice(0, 10).map((r) =>
        h('p', { class: 'batch-failed-item' }, `• ${titleOf(r.id)}：${FAILURE_REASONS[r.code] || '操作失败'}`)
      ),
      failedResults.length > 10
        ? h('p', { class: 'batch-failed-more' }, `…还有 ${failedResults.length - 10} 条`)
        : null,
    ]),
  })
}

async function executeBatch(action, payload, confirmText) {
  if (readLaterStore.selectedCount === 0) return
  try {
    const data = await readLaterStore.batchReview(action, payload)
    if (data) reportBatchResult(data)
  } catch (error) {
    console.error(`${confirmText}失败:`, error)
    ElMessage.error(error.response?.data?.error || `${confirmText}失败，已选条目保持勾选，可重试`)
  }
}

async function confirmBatchRemove() {
  const count = readLaterStore.selectedCount
  if (count === 0) return
  try {
    await ElMessageBox.confirm(
      `确定要将选中的 ${count} 条链接从稍后阅读移除吗？`,
      '确认批量移除',
      { type: 'warning' }
    )
    await executeBatch('remove', {}, '批量移除')
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('操作失败')
    }
  }
}

function openBatchDateDialog() {
  if (readLaterStore.selectedCount === 0) return
  batchScheduleDate.value = null
  batchDateDialogVisible.value = true
}

function setBatchQuickDate(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  batchScheduleDate.value = date
}

async function saveBatchDate() {
  if (!batchScheduleDate.value) {
    ElMessage.warning('请选择回顾日期')
    return
  }
  const review_date = batchScheduleDate.value.toISOString().split('T')[0]
  batchDateDialogVisible.value = false
  await executeBatch('set_date', { review_date }, '批量修改回顾日期')
}
</script>

<style scoped>
.read-later-container {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  font-size: 28px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.page-subtitle {
  font-size: 14px;
  color: #909399;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.stat-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.stat-card.active {
  border-color: #409eff;
  background: #ecf5ff;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
}

.stat-icon.all {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.pending {
  background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
}

.stat-icon.completed {
  background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
}

.stat-icon.skipped {
  background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  line-height: 1;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

.links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
  min-height: 200px;
}

.batch-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #ebeef5;
  flex-wrap: wrap;
}

.selection-count {
  font-size: 13px;
  color: #606266;
  display: flex;
  align-items: center;
  gap: 8px;
}

.batch-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.read-later-card {
  cursor: pointer;
}

.read-later-card.selected {
  border-color: #409eff;
  box-shadow: 0 0 0 1px #409eff;
  background: #f5faff;
}

.card-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-checkbox {
  height: auto;
}

.batch-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: #909399;
}

.batch-result {
  font-size: 13px;
  line-height: 1.6;
}

.batch-failed-item {
  margin: 4px 0 0;
  color: #e6a23c;
  word-break: break-all;
}

.batch-failed-more {
  margin: 4px 0 0;
  color: #909399;
}

.read-later-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease;
  border: 1px solid #ebeef5;
}

.read-later-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.read-later-card.status-completed {
  border-left: 4px solid #67c23a;
}

.read-later-card.status-pending {
  border-left: 4px solid #e6a23c;
}

.read-later-card.status-skipped {
  border-left: 4px solid #909399;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.pending {
  background: #fdf6ec;
  color: #e6a23c;
}

.status-badge.completed {
  background: #f0f9eb;
  color: #67c23a;
}

.status-badge.skipped {
  background: #f4f4f5;
  color: #909399;
}

.card-title {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  text-decoration: none;
  margin-bottom: 8px;
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-title:hover {
  color: #409eff;
}

.card-description {
  font-size: 14px;
  color: #606266;
  margin-bottom: 12px;
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.category-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #fff;
}

.tag-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag-item {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.review-date {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #909399;
}

.pagination {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}

.schedule-form {
  padding: 10px 0;
}

.quick-options {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
</style>
