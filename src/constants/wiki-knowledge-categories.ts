import type { WikiKnowledgeCategory } from '../types/skill'

export const wikiKnowledgeCategoryOptions: Array<{ label: string; value: WikiKnowledgeCategory }> = [
  { label: 'Skill 与工具', value: 'SKILL_TOOL' },
  { label: '项目上下文', value: 'PROJECT_CONTEXT' },
  { label: '企业内部知识', value: 'INTERNAL_KNOWLEDGE' },
  { label: 'FDE 专区', value: 'FDE_WIKI' },
  { label: '其他', value: 'OTHER' },
]

export const externalWikiCategoryOptions = wikiKnowledgeCategoryOptions.filter((option) => option.value !== 'FDE_WIKI')
export function wikiKnowledgeCategoryLabel(value: WikiKnowledgeCategory | null | undefined) {
  return wikiKnowledgeCategoryOptions.find((option) => option.value === value)?.label ?? '未指定'
}
