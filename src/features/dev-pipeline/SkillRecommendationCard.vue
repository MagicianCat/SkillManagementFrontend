<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { SkillCategory } from '../../types/skill'
import type { SkillRecommendation } from './pipeline-content'

const props = defineProps<{
  skill: SkillRecommendation
  category?: SkillCategory
  fallbackCategory: string
}>()

const categoryLabel = computed(() => props.category?.name || props.fallbackCategory)
</script>

<template>
  <article class="recommendation-card">
    <div class="recommendation-card__video" aria-label="演示视频待录制">
      <span class="video-icon" aria-hidden="true">▶</span>
      <span>演示视频待录制</span>
    </div>

    <div class="recommendation-card__body">
      <div class="recommendation-card__meta">
        <span class="recommendation-kind" :class="{ optional: !skill.required }">
          {{ skill.required ? '必选' : '可选' }}
        </span>
        <span class="recommendation-category">{{ categoryLabel }}</span>
      </div>

      <RouterLink
        class="recommendation-card__name"
        :to="{ name: 'skill-detail', params: { skillKey: skill.skillKey } }"
      >
        {{ skill.skillKey }}
      </RouterLink>
      <p class="recommendation-card__tagline">{{ skill.tagline }}</p>
      <p v-if="skill.condition" class="recommendation-card__condition">
        使用条件：{{ skill.condition }}
      </p>

      <details class="recommendation-card__prompt">
        <summary>查看中文提示词</summary>
        <pre>{{ skill.prompt }}</pre>
      </details>

      <div class="recommendation-card__artifact">
        <span>预期产物</span>
        <code>{{ skill.artifact }}</code>
      </div>
      <p v-if="skill.reusedIn" class="recommendation-card__reuse">
        ↻ {{ skill.reusedIn }}
      </p>
    </div>
  </article>
</template>

<style scoped>
.recommendation-card {
  display: grid;
  overflow: hidden;
  border: 1px solid #e7ebf1;
  border-radius: 14px;
  background: #fbfcfe;
}

.recommendation-card__video {
  display: grid;
  min-height: 112px;
  place-items: center;
  align-content: center;
  gap: 7px;
  color: #8290a5;
  background: linear-gradient(135deg, #eef2f7, #f8fafc);
  font-size: 11px;
}

.video-icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  padding-left: 2px;
  border: 1px solid #cbd4e1;
  border-radius: 50%;
  color: #62728a;
  font-size: 11px;
}

.recommendation-card__body { padding: 14px; }

.recommendation-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.recommendation-kind,
.recommendation-category {
  padding: 3px 7px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 750;
}

.recommendation-kind { color: #176b5f; background: #e2f3ef; }
.recommendation-kind.optional { color: #7b5d1d; background: #fff4d9; }
.recommendation-category { color: #546783; background: #edf1f6; font-weight: 600; }

.recommendation-card__name {
  display: inline-block;
  margin-top: 11px;
  color: #1b5da8;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
}

.recommendation-card__name:hover { text-decoration: underline; }
.recommendation-card__name:focus-visible { outline: 2px solid #2f7dcc; outline-offset: 3px; border-radius: 3px; }
.recommendation-card__tagline { margin: 5px 0 0; color: #526176; font-size: 12px; line-height: 1.6; }
.recommendation-card__condition, .recommendation-card__reuse { margin: 8px 0 0; color: #8a6c2c; font-size: 11px; line-height: 1.5; }
.recommendation-card__reuse { color: #78869a; }

.recommendation-card__prompt { margin-top: 12px; }
.recommendation-card__prompt summary { display: inline-flex; align-items: center; gap: 5px; color: #386fa8; font-size: 11px; font-weight: 750; cursor: pointer; }
.recommendation-card__prompt summary::before { content: '＋'; font-size: 13px; }
.recommendation-card__prompt[open] summary::before { content: '−'; }
.recommendation-card__prompt summary:focus-visible { outline: 2px solid #2f7dcc; outline-offset: 3px; }
.recommendation-card__prompt pre { overflow: auto; max-height: 260px; margin: 10px 0 0; padding: 11px; border-radius: 9px; color: #dfe8f4; background: #243149; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; line-height: 1.65; white-space: pre-wrap; word-break: break-word; }

.recommendation-card__artifact { display: grid; gap: 4px; margin-top: 14px; padding-top: 10px; border-top: 1px solid #e7ebf1; color: #8792a3; font-size: 10px; }
.recommendation-card__artifact code { overflow: hidden; color: #536783; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
</style>
