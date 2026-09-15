<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { createSkill, getSkillCategories, uploadDraftZip } from '../api/skills.api'
import { searchWikiTeams } from '../api/wiki.api'
import type { SkillCategory, WikiTeam } from '../types/skill'

const router = useRouter()

const form = reactive({
  skillKey: '',
  displayName: '',
  description: '',
  sourceUrl: '',
  categoryId: null as number | null,
  teamId: null as number | null,
})
const submitting = ref(false)
const errorMessage = ref('')
const keyConflict = ref(false)
const teams = ref<WikiTeam[]>([])
const categories = ref<SkillCategory[]>([])
const categoryOptions = computed(() => categories.value.filter((item) => item.parentId === null).map((root) => ({
  // 父级仅用于展开，不能 disabled，否则 TDesign 会连同叶子一起禁用。
  label: root.name, value: root.id,
  children: categories.value.filter((item) => item.parentId === root.id).map((leaf) => ({ label: leaf.name, value: leaf.id, disabled: !leaf.selectable })),
})))
const teamLoading = ref(false)
let teamSearchTimer: ReturnType<typeof setTimeout> | undefined

// 上传 ZIP 阶段
const createdKey = ref('')
const zipFile = ref<File | null>(null)
const changeLog = ref('')
const uploading = ref(false)
const uploadError = ref('')

const KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

function searchTeams(keyword = '') {
  if (teamSearchTimer) clearTimeout(teamSearchTimer)
  teamSearchTimer = setTimeout(async () => {
    teamLoading.value = true
    try {
      const page = await searchWikiTeams(keyword)
      const selectedTeam = teams.value.find((team) => team.id === form.teamId)
      teams.value = selectedTeam && !page.items.some((team) => team.id === selectedTeam.id)
        ? [selectedTeam, ...page.items]
        : page.items
    } catch {
      errorMessage.value = '团队加载失败，请稍后重试'
    } finally {
      teamLoading.value = false
    }
  }, 300)
}

searchTeams()
onMounted(async () => { categories.value = await getSkillCategories() })

function validate(): string {
  if (!KEY_PATTERN.test(form.skillKey))
    return 'Skill Key 只能使用小写字母、数字和单个连字符分段'
  if (!form.displayName.trim()) return '请输入展示名称'
  if (!form.description.trim()) return '请输入描述'
  if (!form.categoryId) return '请选择研发全流程分类'
  return ''
}

async function submit() {
  errorMessage.value = ''
  keyConflict.value = false
  const message = validate()
  if (message) {
    errorMessage.value = message
    return
  }
  submitting.value = true
  try {
    await createSkill({
      skillKey: form.skillKey,
      displayName: form.displayName.trim(),
      description: form.description.trim(),
      categoryId: form.categoryId!,
      teamId: form.teamId,
      sourceUrl: form.sourceUrl.trim() || null,
    })
    createdKey.value = form.skillKey
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      keyConflict.value = true
      errorMessage.value = '该 Skill Key 已存在，请更换'
    } else {
      errorMessage.value = axios.isAxiosError(error)
        ? String(error.response?.data?.message ?? '创建失败，请稍后重试')
        : '创建失败，请稍后重试'
    }
  } finally {
    submitting.value = false
  }
}

function onZipChange(event: Event) {
  const input = event.target as HTMLInputElement
  zipFile.value = input.files?.[0] ?? null
  uploadError.value = ''
}

async function uploadAndEdit() {
  if (!zipFile.value) {
    uploadError.value = '请选择 .zip 文件'
    return
  }
  if (!zipFile.value.name.toLowerCase().endsWith('.zip')) {
    uploadError.value = '仅支持 .zip 文件'
    return
  }
  uploading.value = true
  uploadError.value = ''
  try {
    await uploadDraftZip(
      createdKey.value,
      zipFile.value,
      changeLog.value.trim() || undefined,
    )
    await router.replace({
      name: 'skill-draft',
      params: { skillKey: createdKey.value },
    })
  } catch (error: unknown) {
    uploadError.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '上传失败，请稍后重试')
      : '上传失败，请稍后重试'
  } finally {
    uploading.value = false
  }
}

function skipUpload() {
  void router.replace({
    name: 'skill-detail',
    params: { skillKey: createdKey.value },
  })
}
</script>

<template>
  <div class="create-page">
    <button class="back-link" @click="router.push({ name: 'skills' })">
      ← 返回 Skill 市场
    </button>

    <!-- 上传 ZIP 对话框 -->
    <div v-if="createdKey" class="modal-mask">
      <div class="modal" role="dialog" aria-labelledby="upload-title">
        <h2 id="upload-title">Skill 已创建，上传初始 ZIP</h2>
        <p class="modal-desc">
          为 <strong>{{ createdKey }}</strong> 上传包含
          <code>SKILL.md</code> 的 ZIP 包，上传成功后直接进入编辑页面。
        </p>
        <label class="modal-field">
          ZIP 文件
          <input type="file" accept=".zip" @change="onZipChange" />
        </label>
        <label class="modal-field">
          变更说明（可选）
          <input
            v-model="changeLog"
            type="text"
            placeholder="本次上传说明"
            :disabled="uploading"
          />
        </label>
        <p v-if="uploadError" class="inline-error" role="alert">
          {{ uploadError }}
        </p>
        <div class="modal-actions">
          <button class="btn-secondary" :disabled="uploading" @click="skipUpload">
            稍后上传
          </button>
          <button
            class="btn-primary"
            :disabled="uploading || !zipFile"
            @click="uploadAndEdit"
          >
            {{ uploading ? '上传中…' : '上传并进入编辑' }}
          </button>
        </div>
      </div>
    </div>

    <div class="page-heading">
      <p class="eyebrow">NEW SKILL</p>
      <h1>新建 Skill</h1>
      <p class="page-subtitle">创建后上传 ZIP 包即可开始编辑内容</p>
    </div>

    <form class="create-form" novalidate @submit.prevent="submit">
      <label class="form-field">
        <span>Skill Key <em>*</em></span>
        <input
          v-model="form.skillKey"
          type="text"
          placeholder="例如 springboot-tdd"
          :disabled="submitting || Boolean(createdKey)"
          :class="{ 'has-error': keyConflict }"
        />
        <small>小写字母、数字和单个连字符；创建后不可修改</small>
      </label>
      <label class="form-field">
        <span>可见范围</span>
        <t-select
          v-model="form.teamId"
          filterable
          clearable
          :loading="teamLoading"
          :disabled="submitting || Boolean(createdKey)"
          :options="[
            { label: '平台级（全公司可见）', value: null },
            ...teams.map((team) => ({ label: `团队：${team.name}`, value: team.id })),
          ]"
          placeholder="选择可见范围，支持搜索团队"
          @search="searchTeams"
        />
      </label>
      <label class="form-field">
        <span>展示名称 <em>*</em></span>
        <input
          v-model="form.displayName"
          type="text"
          placeholder="例如 Spring Boot TDD"
          :disabled="submitting || Boolean(createdKey)"
        />
      </label>
      <label class="form-field">
        <span>研发全流程分类 <em>*</em></span>
        <t-cascader v-model="form.categoryId" :options="categoryOptions" clearable filterable
          placeholder="请选择具体分类" :disabled="submitting || Boolean(createdKey)" />
      </label>
      <label class="form-field">
        <span>描述 <em>*</em></span>
        <textarea
          v-model="form.description"
          rows="4"
          placeholder="简要描述这个 Skill 的用途"
          :disabled="submitting || Boolean(createdKey)"
        ></textarea>
      </label>
      <label class="form-field">
        <span>来源网址</span>
        <input
          v-model="form.sourceUrl"
          type="url"
          placeholder="例如 https://github.com/example/repository"
          :disabled="submitting || Boolean(createdKey)"
        />
        <small>可填写 Skill 的官方文档、代码仓库或内部来源地址</small>
      </label>
      <p v-if="errorMessage" class="inline-error" role="alert">
        {{ errorMessage }}
      </p>
      <div class="form-actions">
        <button
          type="button"
          class="btn-secondary"
          :disabled="submitting"
          @click="router.push({ name: 'skills' })"
        >
          取消
        </button>
        <button
          type="submit"
          class="btn-primary"
          :disabled="submitting || Boolean(createdKey)"
        >
          {{ submitting ? '创建中…' : '创建 Skill' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.create-page {
  width: min(100%, 720px);
  margin: 0 auto;
}
.create-form {
  display: grid;
  gap: 18px;
  padding: 24px;
  border: 1px solid #ece1d2;
  border-radius: 10px;
  background: #fff;
}
.form-field {
  display: grid;
  gap: 7px;
}
.form-field span {
  color: #334155;
  font-size: 13px;
  font-weight: 650;
}
.form-field em {
  color: #dc2626;
  font-style: normal;
}
.form-field small {
  color: #94a3b8;
  font-size: 11px;
}
.form-field input,
.form-field select,
.form-field textarea {
  padding: 9px 11px;
  border: 1px solid #dfcfb8;
  border-radius: 7px;
  color: #1e293b;
  background: #fff;
  font: inherit;
  font-size: 13px;
  outline: none;
}
.form-field input:focus,
.form-field select:focus,
.form-field textarea:focus {
  border-color: #e86600;
  box-shadow: 0 0 0 3px rgb(232 102 0 / 18%);
}
.form-field input.has-error {
  border-color: #dc2626;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}
.btn-primary,
.btn-secondary {
  height: 38px;
  padding: 0 16px;
  border-radius: 7px;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}
.btn-primary {
  border: 0;
  color: #fff;
  background: #e86600;
}
.btn-primary:hover:not(:disabled) {
  background: #c25400;
}
.btn-primary:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.btn-secondary {
  border: 1px solid #dfcfb8;
  color: #475569;
  background: #fff;
}
.btn-secondary:hover:not(:disabled) {
  background: #fbf6f0;
}
.inline-error {
  margin: 0;
  color: #b91c1c;
  font-size: 12px;
}
.modal-mask {
  position: fixed;
  z-index: 40;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(15 23 42 / 45%);
}
.modal {
  width: min(92vw, 460px);
  padding: 24px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 20px 50px rgb(15 23 42 / 18%);
}
.modal h2 {
  margin: 0;
  color: #0f172a;
  font-size: 17px;
}
.modal-desc {
  margin: 10px 0 18px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}
.modal-desc code {
  padding: 1px 5px;
  border-radius: 4px;
  background: #f6efe5;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
}
.modal-field {
  display: grid;
  gap: 7px;
  margin-bottom: 14px;
  color: #334155;
  font-size: 12px;
  font-weight: 650;
}
.modal-field input {
  padding: 8px 10px;
  border: 1px solid #dfcfb8;
  border-radius: 7px;
  font: inherit;
  font-size: 13px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}
</style>
