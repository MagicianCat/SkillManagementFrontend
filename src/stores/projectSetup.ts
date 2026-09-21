import { ref } from 'vue'
import { defineStore } from 'pinia'
import { applyPreset, confirmProjectAgentConfiguration, copyProjectConfiguration, getProjectAgentConfiguration, listReusableProjects, updateProjectAgentNode, validateProjectAgentConfiguration } from '../api/agent-library.api'
import type { ProjectAgentConfiguration, ProjectConfigValidation, ReusableProject } from '../types/agent-library'

export const useProjectSetupStore = defineStore('projectSetup', () => {
  const configuration = ref<ProjectAgentConfiguration | null>(null); const reusableProjects = ref<ReusableProject[]>([]); const selectedNodeKey = ref(''); const loading = ref(false); const error = ref(''); const validation = ref<ProjectConfigValidation | null>(null)
  async function load(projectKey: string) { loading.value = true; error.value = ''; try { configuration.value = await getProjectAgentConfiguration(projectKey) } catch (cause) { error.value = cause instanceof Error ? cause.message : '配置加载失败' } finally { loading.value = false } }
  async function usePreset(projectKey: string, presetVersionId: string | number) { configuration.value = await applyPreset(projectKey, presetVersionId) }
  async function copyFrom(projectKey: string, sourceProjectKey: string) { configuration.value = await copyProjectConfiguration(projectKey, sourceProjectKey) }
  async function replaceNode(projectKey: string, stageKey: string, nodeKey: string, versionId: string | number) { configuration.value = await updateProjectAgentNode(projectKey, stageKey, nodeKey, versionId) }
  async function validate(projectKey: string) {
    validation.value = await validateProjectAgentConfiguration(projectKey)
    if (validation.value.valid) configuration.value = await getProjectAgentConfiguration(projectKey)
    return validation.value
  }
  function clearValidation() { validation.value = null }
  async function confirm(projectKey: string) { configuration.value = await confirmProjectAgentConfiguration(projectKey); return configuration.value }
  async function loadReusable(projectKey: string) { reusableProjects.value = await listReusableProjects(projectKey) }
  return { configuration, reusableProjects, selectedNodeKey, loading, error, validation, load, usePreset, copyFrom, replaceNode, validate, clearValidation, confirm, loadReusable }
})
