export type SkillPlatform = 'CODEBUDDY' | 'OPENCODE'
export type SkillOsType = 'ANY' | 'WINDOWS' | 'MACOS' | 'LINUX'

export interface SkillInstallLocation {
  scope: 'PROJECT' | 'GLOBAL'
  label: string
  path: string
}

export interface SkillInstallGuide {
  platformLabel: string
  osLabel: string
  locations: SkillInstallLocation[]
  note: string
}

const platformLabels: Record<SkillPlatform, string> = {
  CODEBUDDY: 'CodeBuddy',
  OPENCODE: 'OpenCode',
}

const osLabels: Record<SkillOsType, string> = {
  ANY: '通用系统',
  WINDOWS: 'Windows',
  MACOS: 'macOS',
  LINUX: 'Linux',
}

function pathParts(osType: SkillOsType): {
  separator: '\\' | '/'
  home: string
  project: string
} {
  if (osType === 'WINDOWS') {
    return { separator: '\\', home: '%USERPROFILE%', project: '<项目根目录>' }
  }
  return { separator: '/', home: '~', project: '<项目根目录>' }
}

export function getSkillInstallGuide(
  platform: string,
  osType: string,
  skillKey: string,
): SkillInstallGuide {
  const normalizedPlatform: SkillPlatform = platform === 'OPENCODE' ? 'OPENCODE' : 'CODEBUDDY'
  const normalizedOs: SkillOsType = ['WINDOWS', 'MACOS', 'LINUX'].includes(osType)
    ? osType as SkillOsType
    : 'ANY'
  const { separator, home, project } = pathParts(normalizedOs)
  const directory = normalizedPlatform === 'CODEBUDDY' ? '.codebuddy' : '.opencode'
  const globalDirectory = normalizedPlatform === 'CODEBUDDY'
    ? '.codebuddy'
    : `.config${separator}opencode`
  const suffix = `${separator}skills${separator}${skillKey}${separator}`

  return {
    platformLabel: platformLabels[normalizedPlatform],
    osLabel: osLabels[normalizedOs],
    locations: [
      {
        scope: 'PROJECT',
        label: '项目级 Skill',
        path: `${project}${separator}${directory}${suffix}`,
      },
      {
        scope: 'GLOBAL',
        label: '全局 Skill',
        path: `${home}${separator}${globalDirectory}${suffix}`,
      },
    ],
    note: normalizedOs === 'ANY'
      ? '请根据当前电脑系统选择对应目录；Windows 用户请将 ~ 替换为 %USERPROFILE%。'
      : '解压后请确保 SKILL.md 位于上方 Skill 目录内，不要再多嵌套一层同名目录。',
  }
}
