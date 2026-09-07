<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { createSkill, uploadDraftZip } from '../api/skills.api'
import { DEVELOPMENT_STAGES, type DevelopmentStage } from '../types/skill'
import { getTeamTree, type TeamView } from '../api/org.api'

const router = useRouter()

const form = reactive({
  skillKey: '',
  displayName: '',
  description: '',
  developmentStage: 'REQUIREMENT' as DevelopmentStage,
  teamId: null as number | null,
})
const submitting = ref(false)
const errorMessage = ref('')
const keyConflict = ref(false)
const teams = ref<TeamView[]>([])

// 上传 ZIP 阶段
const createdKey = ref('')
const zipFile = ref<File | null>(null)
const changeLog = ref('')
const uploading = ref(false)
const uploadError = ref('')

const KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

void getTeamTree().then((value) => { teams.value = value }).catch(() => undefined)

function validate(): string {
  if (!KEY_PATTERN.test(form.skillKey))
    return 'Skill Key 只能使用小写字母、数字和单个连字符分段'
  if (!form.displayName.trim()) return '请输入展示名称'
  if (!form.description.trim()) return '请输入描述'
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
      developmentStage: form.developmentStage,
      teamId: form.teamId,
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
        <select v-model="form.teamId" :disabled="submitting || Boolean(createdKey)">
          <option :value="null">平台级（全公司可见）</option>
          <option v-for="team in teams" :key="team.id" :value="team.id">团队：{{ team.name }}</option>
        </select>
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
        <span>开发阶段</span>
        <select
          v-model="form.developmentStage"
          :disabled="submitting || Boolean(createdKey)"
        >
          <option
            v-for="stage in DEVELOPMENT_STAGES"
            :key="stage.value"
            :value="stage.value"
          >
            {{ stage.label }}
          </option>
        </select>
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
  border: 1px solid #e2e8f0;
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
  border: 1px solid #cbd5e1;
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
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgb(79 70 229 / 12%);
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
  background: #4f46e5;
}
.btn-primary:hover:not(:disabled) {
  background: #4338ca;
}
.btn-primary:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.btn-secondary {
  border: 1px solid #cbd5e1;
  color: #475569;
  background: #fff;
}
.btn-secondary:hover:not(:disabled) {
  background: #f8fafc;
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
  background: #f1f5f9;
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
  border: 1px solid #cbd5e1;
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
