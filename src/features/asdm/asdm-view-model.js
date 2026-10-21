export const ASDM_STATUS_LABELS = Object.freeze({
  DISABLED: 'Skill 模式',
  SCANNING: 'ASDM 自动检测中',
  NOT_READY: '等待标志产物',
  WAITING_FILES: '待文件',
  MARKER_READY: '标志已满足',
  DEBOUNCING: '静默中',
  NOTIFIED: '待发布',
  CONFIRM_REQUESTED: '确认中',
  CLAIMED: '发布中',
  PUBLISHING: '发布中',
  PUBLISHING_FILES: '发布中',
  PUBLISHING_INDEX: '发布中',
  PARTIAL_FAILED: '部分失败',
  PARTIAL_FAILED_PACKAGE: '部分失败',
  PUBLISHED: '已发布',
  COMPLETED: '已发布',
  AUTH_PAUSED: 'Token 失效',
  ERROR: '检测异常',
  TRUNCATED: '扫描不完整',
})

export function asdmStatusLabel(status) {
  return ASDM_STATUS_LABELS[status] || (status ? `ASDM · ${status}` : 'ASDM 自动检测中')
}

export function groupCandidateFiles(files = []) {
  const groups = { confirmed: [], likely: [], uncertain: [], external: [], excluded: [] }
  for (const file of files) {
    if (file.association === 'CONFIRMED') groups.confirmed.push(file)
    else if (file.association === 'LIKELY') groups.likely.push(file)
    else if (file.association === 'UNCERTAIN' || file.association === 'OVERSIZE') groups.uncertain.push(file)
    else if (file.association === 'EXTERNAL_REF') groups.external.push(file)
    else groups.excluded.push(file)
  }
  return groups
}

export function isRetryableFile(status) {
  return ['FAILED', 'RECONCILE_REQUIRED'].includes(status)
}
