<script setup lang="ts">
/**
 * 开发全链路最佳实践（静态页）
 *
 * - 流程树：需求 → {架构 ∥ UI设计} → {前端编码 ∥ 后端编码} → 测试 → 发布（含反馈回路）
 * - 每阶段推荐 ≤5 个 ECC Skills 及使用示例提示词
 * - 泰康橙风格；纯静态实现未引入组件库；若引入 TS 组件遵循腾讯 TDesign 规范
 */

interface SkillRec {
  name: string
  tagline: string
  prompt: string
}

interface Stage {
  id: string
  no: string
  name: string
  en: string
  phase: 'serial' | 'parallel' | 'join' | 'end'
  phaseLabel: string
  dep: string
  desc: string
  deliverables: string[]
  skills: SkillRec[]
}

const stages: Stage[] = [
  {
    id: 'stage-requirements',
    no: '01',
    name: '需求分析',
    en: 'Requirements',
    phase: 'serial',
    phaseLabel: '串行起点',
    dep: '全链路起点',
    desc: '明确业务目标、用户画像与范围，将模糊想法转化为可验证的验收标准，输出需求文档与排期。',
    deliverables: ['PRD / 需求文档', '用户故事', '验收标准', '范围与排期', '调研报告'],
    skills: [
      {
        name: 'deep-research',
        tagline: '多源深度调研（firecrawl/exa），输出带引用来源的报告',
        prompt: '使用 deep-research 技能，调研"技能管理平台"的替代方案与核心竞品能力矩阵，输出带引用来源的调研报告，并提炼 3 条对本需求定义的影响结论。',
      },
      {
        name: 'market-research',
        tagline: '市场容量、竞品对比与行业情报，决策导向摘要',
        prompt: '使用 market-research 技能，完成企业级 Skills 平台的市场规模估算与主要竞品对比，输出决策导向摘要（含来源引用），并给出我们的差异化切入建议。',
      },
      {
        name: 'intent-driven-development',
        tagline: '把模糊的产品/工程变更拆成可验收标准，降低返工',
        prompt: '使用 intent-driven-development 技能，把"做一个需求创建与审核流程"拆解为可验证的验收标准：场景、输入、预期输出、权限与安全约束。',
      },
      {
        name: 'plan-canvas',
        tagline: '把计划放到浏览器画布上批注、评审、批准',
        prompt: '使用 plan-canvas 技能将本需求方案渲染到本地浏览器画布，标注模块依赖与验收点，收集评审意见后批准或调整。',
      },
      {
        name: 'blueprint',
        tagline: '一行目标 → 多会话工程化的分步施工蓝图',
        prompt: '使用 blueprint 技能，把"3 周内上线技能市场 MVP"转化为分步施工蓝图：每步带独立上下文简报，含对抗性评审关卡与完成定义。',
      },
    ],
  },
  {
    id: 'stage-architecture',
    no: '02',
    name: '架构设计',
    en: 'Architecture',
    phase: 'parallel',
    phaseLabel: '可并行',
    dep: '与 UI 设计并行，等待需求基线冻结',
    desc: '确定技术选型、系统分层与模块边界，输出架构决策记录（ADR）、接口契约与数据模型，为两端编码提供基线。',
    deliverables: ['技术方案', 'ADR 记录', 'OpenAPI 契约', '数据模型', '部署拓扑'],
    skills: [
      {
        name: 'architecture-decision-records',
        tagline: '把散落架构决策沉淀为结构 ADR 日志',
        prompt: '使用 architecture-decision-records 技能，为"前端 Vue 3 + 腾讯 TDesign、后端 API 服务"的技术栈撰写 ADR：背景、备选方案、取舍理由与影响，落入 ADR 日志。',
      },
      {
        name: 'hexagonal-architecture',
        tagline: 'Ports & Adapters：领域不依赖框架，易测易替',
        prompt: '使用 hexagonal-architecture 技能为后端服务设计 Ports & Adapters 边界：领域层不依赖框架，输出模块划分、依赖方向与用例编排。',
      },
      {
        name: 'api-design',
        tagline: 'REST 资源命名、状态码、分页、版本化与限流',
        prompt: '使用 api-design 技能评审技能市场 REST API：资源命名、状态码、分页/过滤、错误体、版本化与限流是否生产级，给出逐条修改建议。',
      },
      {
        name: 'contract-first',
        tagline: '契约先行，防止前后端 schema 漂移与字段错位',
        prompt: '使用 contract-first 技能，先用 OpenAPI 契约为前端/后端定义接口，导出 TypeScript 类型声明，双方按契约并行开发。',
      },
      {
        name: 'backend-patterns',
        tagline: 'Node.js/Express 分层、数据访问与性能模式',
        prompt: '使用 backend-patterns 技能设计后端服务分层与数据访问策略，评估缓存、批处理与连接池等模式是否合适。',
      },
    ],
  },
  {
    id: 'stage-ui',
    no: '03',
    name: 'UI 设计',
    en: 'UI Design',
    phase: 'parallel',
    phaseLabel: '可并行',
    dep: '与架构设计并行，可先行产出高保真原型',
    desc: '基于需求产出设计方向、设计系统 Token 与高保真原型，遵循泰康橙品牌规范与 WCAG 2.2 AA 无障碍要求。',
    deliverables: ['设计 Token', '高保真原型', '组件规范', '无障碍清单', '演示视频'],
    skills: [
      {
        name: 'frontend-design-direction',
        tagline: '为生产级 UI 设定设计方向与风格基线',
        prompt: '使用 frontend-design-direction 技能为"技能管理平台"设定设计方向：以泰康橙（约 #FF7A00）为主色，定义字体、间距、圆角、阴影与组件风格，输出设计指南。',
      },
      {
        name: 'design-system',
        tagline: '扫描现有代码生成/审计设计系统 Token',
        prompt: '使用 design-system 技能扫描现有前端代码，抽取色彩/字体/间距/圆角 Token 生成 DESIGN.md 与自包含预览页；同时审计视觉一致性。',
      },
      {
        name: 'make-interfaces-feel-better',
        tagline: '从间距、字重、阴影、动效到热区的细节打磨',
        prompt: '使用 make-interfaces-feel-better 技能 review 登录页与侧边栏的间距、字重、边框阴影、hover 状态与点击热区，输出 5 条具体改进。',
      },
      {
        name: 'accessibility',
        tagline: 'WCAG 2.2 AA：键盘、对比度、读屏器语义',
        prompt: '使用 accessibility 技能按 WCAG 2.2 AA 审计新页面：键盘可达、色彩对比、读屏器语义与焦点管理，输出问题清单与修复建议。',
      },
      {
        name: 'ui-demo',
        tagline: '用 Playwright 录制高保真 UI 演示（WebM）',
        prompt: '使用 ui-demo 技能录制"技能市场"主流程演示视频（可见光标、自然节奏、WebM 输出），用于评审与发布材料。',
      },
    ],
  },
  {
    id: 'stage-frontend',
    no: '04',
    name: '前端编码',
    en: 'Frontend Coding',
    phase: 'parallel',
    phaseLabel: '可并行',
    dep: '依赖：架构契约 + UI 设计稿；与后端编码并行',
    desc: '按契约与设计稿实现界面与交互，组件化、类型安全、性能优化；若使用 TS 组件一律遵循腾讯 TDesign 规范（本静态页未引入组件）。',
    deliverables: ['可运行前端', 'Vue 3 组件', '类型安全 API 调用', 'Lint/测试', '设计稿还原'],
    skills: [
      {
        name: 'vue-patterns',
        tagline: 'Vue 3 Composition API、Pinia、Router 与响应式最佳实践',
        prompt: '使用 vue-patterns 技能实现技能列表页：组件拆分、Pinia 状态、路由守卫与响应式性能要点，符合 Composition API 规范。',
      },
      {
        name: 'ui-to-vue',
        tagline: 'UI 截图/设计稿批量转 Vue 3 组件',
        prompt: '使用 ui-to-vue 技能将 Stitch/Figma 导出的 UI 截图批量转为 Vue 3 组件（本项目现有 Element Plus 风格；若改用 TDesign 需同步替换）。',
      },
      {
        name: 'coding-standards',
        tagline: '命名、可读性、不可变性等跨项目编码基线',
        prompt: '使用 coding-standards 技能 review 本次前端的命名、组件粒度与可读性，输出与团队基线不一致的点。',
      },
      {
        name: 'tdd-workflow',
        tagline: '红-绿-重构，单测/集成/E2E 覆盖 ≥ 80%',
        prompt: '使用 tdd-workflow 技能为"技能审核通过/驳回"逻辑先写失败测试再实现，最终覆盖率达到 80% 以上。',
      },
      {
        name: 'error-handling',
        tagline: '类型化错误、Retry、熔断与用户可读的提示',
        prompt: '使用 error-handling 技能统一前端请求错误处理：类型化 API 错误、重试/熔断策略与用户可读提示，避免裸 catch。',
      },
    ],
  },
  {
    id: 'stage-backend',
    no: '05',
    name: '后端编码',
    en: 'Backend Coding',
    phase: 'parallel',
    phaseLabel: '可并行',
    dep: '依赖：架构契约；与前端编码并行',
    desc: '按契约实现业务与数据访问，完成数据库迁移、错误处理与容器化，保障接口质量与可观测性。',
    deliverables: ['API 服务', '数据迁移', '错误与日志', '容器镜像', '接口联调报告'],
    skills: [
      {
        name: 'backend-patterns',
        tagline: '后端分层、REST 与数据访问模式',
        prompt: '使用 backend-patterns 技能落地后端分层：控制器-服务-仓储职责清晰，数据访问走统一抽象，评审缓存与批处理选型。',
      },
      {
        name: 'database-migrations',
        tagline: '模式迁移、数据迁移、回滚与零停机',
        prompt: '使用 database-migrations 技能为技能版本表设计迁移：向前兼容的 schema 变更、数据回填与回滚脚本，保证零停机发布。',
      },
      {
        name: 'api-design',
        tagline: '实现期按契约自审 REST 端点',
        prompt: '使用 api-design 技能在实现完成后自审新端点：状态码、分页、错误体与版本化是否与契约一致，不一致处给出修正。',
      },
      {
        name: 'error-handling',
        tagline: '类型化异常、重试/熔断、对外错误体',
        prompt: '使用 error-handling 技能统一后端异常：自定义错误码、重试与熔断策略、对外统一错误响应体，避免堆栈泄露。',
      },
      {
        name: 'docker-patterns',
        tagline: '镜像分层、健康检查与环境隔离最佳实践',
        prompt: '使用 docker-patterns 技能编写服务 Dockerfile：多阶段构建、非 root 用户、健康检查与镜像瘦身，输出生产可用配置。',
      },
    ],
  },
  {
    id: 'stage-testing',
    no: '06',
    name: '测试',
    en: 'Testing',
    phase: 'join',
    phaseLabel: '汇聚点',
    dep: '依赖：前端/后端编码完成合入',
    desc: '前/后端完成后进入全量测试：单元、集成、E2E 与回归，安全扫描与质量门禁通过后方可发布。',
    deliverables: ['单测/集成/E2E', '回归报告', '覆盖率门禁', '安全扫描', '可发布结论'],
    skills: [
      {
        name: 'tdd-workflow',
        tagline: '测试先行，覆盖 ≥ 80%',
        prompt: '使用 tdd-workflow 技能补充/收敛测试套件：以 .plan.md 描述接口，先测后码，目标单测/集成/E2E 覆盖 80%+。',
      },
      {
        name: 'e2e-testing',
        tagline: 'Playwright 页面对象模型与 CI 集成',
        prompt: '使用 e2e-testing 技能为关键旅程写 Playwright 用例：登录 → 检索 Skill → 提交审核，采用 POM 并接入 CI。',
      },
      {
        name: 'browser-qa',
        tagline: '部署后浏览器自动化做视觉与交互验证',
        prompt: '使用 browser-qa 技能在测试环境自动检查页面渲染、交互与视觉回归，输出失败截图与差异。',
      },
      {
        name: 'ai-regression-testing',
        tagline: 'AI 辅助开发的回归策略与盲点排查',
        prompt: '使用 ai-regression-testing 技能对本次 AI 辅助产出的变更做回归：沙箱 API 测试、自动化缺陷检查，避免同模型自写自测的盲点。',
      },
      {
        name: 'verification-loop',
        tagline: '收尾前系统性验证，防止"以为完成了"',
        prompt: '使用 verification-loop 技能在提交前跑一遍完整验证：类型检查、测试、构建与增量变更核对，达标后再声明完成。',
      },
    ],
  },
  {
    id: 'stage-release',
    no: '07',
    name: '发布',
    en: 'Release',
    phase: 'end',
    phaseLabel: '终点 + 反馈',
    dep: '依赖：测试门禁通过',
    desc: '灰度/全量上线、监控与回滚预案，发布后持续观测并回哺到下一轮迭代，形成闭环。',
    deliverables: ['发布计划', 'CD 流水线', '灰度与监控', '回滚预案', '线上审计'],
    skills: [
      {
        name: 'deployment-patterns',
        tagline: 'CI/CD、Docker、健康检查与生产就绪清单',
        prompt: '使用 deployment-patterns 技能搭建 CI/CD 流水线与生产就绪检查：构建 → 测试 → 镜像 → 健康检查 → 回滚策略。',
      },
      {
        name: 'delivery-gate',
        tagline: '质量门禁：未达标禁止"完成"',
        prompt: '使用 delivery-gate 技能在发布前启用质量门禁：测试/构建/日志陈旧度不达标时阻止宣布完成，并输出不通过原因。',
      },
      {
        name: 'canary-watch',
        tagline: '发布后冒烟/金丝雀：HTTP、SSE、静态资源与控制台',
        prompt: '使用 canary-watch 技能在发布后监控线上 URL：HTTP 状态、SSE 流、静态资源、控制台错误与性能回归。',
      },
      {
        name: 'production-audit',
        tagline: '本地证据的生产就绪审计',
        prompt: '使用 production-audit 技能做上线前审计：配置、密钥、依赖与"线上会坏在哪"逐一核验，输出修复清单。',
      },
      {
        name: 'git-workflow',
        tagline: '分支策略、提交规范与发布标签',
        prompt: '使用 git-workflow 技能为本次发布制定分支/标签规范：特性分支 + PR 评审 + 语义化 Tag，回溯发布记录。',
      },
    ],
  },
]

const totalSkills = stages.reduce((acc, s) => acc + s.skills.length, 0)
const uniqueSkills = new Set(stages.flatMap((s) => s.skills.map((k) => k.name))).size
</script>

<template>
  <div class="devpipeline-page">
    <!-- ===== 头部 ===== -->
    <header class="devpipeline-hero">
      <p class="devpipeline-eyebrow">TAIKANG · DEV BEST PRACTICES</p>
      <h1>开发全链路最佳实践</h1>
      <p class="devpipeline-lead">
        从需求到发布的一体化流程树：标出可并行阶段、每阶段的交付物，
        以及各阶段推荐的 <strong>ECC Skills</strong> 与使用示例提示词。
      </p>
      <div class="devpipeline-stats">
        <div class="stat"><strong>7</strong><span>全链路阶段</span></div>
        <div class="stat"><strong>{{ totalSkills }}</strong><span>技能推荐条目</span></div>
        <div class="stat"><strong>{{ uniqueSkills }}</strong><span>ECC Skills</span></div>
        <div class="stat"><strong>2</strong><span>可并行支线</span></div>
      </div>
    </header>

    <!-- ===== 流程树 ===== -->
    <section class="devpipeline-section" id="flow-tree" aria-labelledby="flow-tree-h2">
      <div class="devpipeline-section-head">
        <h2 id="flow-tree-h2"><span>01</span> 全链路流程树</h2>
        <p>需求为串行起点；「架构设计 ∥ UI 设计」「前端编码 ∥ 后端编码」可并行；测试为汇聚点；发布后经反馈回路进入下一轮迭代。</p>
      </div>

      <div class="flow-tree-card">
        <svg class="flow-tree" viewBox="0 0 960 560" role="img" aria-labelledby="flow-tree-title">
          <title id="flow-tree-title">开发全链路最佳实践流程树：需求 → 架构与UI设计并行 → 前端与后端编码并行 → 测试汇聚 → 发布，并带反馈回路</title>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#E86600" />
            </marker>
            <marker id="arrow-dash" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#8A8F98" />
            </marker>
          </defs>

          <!-- 连线（实线 = 主干，虚线 = 反馈回路） -->
          <g stroke="#E86600" stroke-width="2.5" fill="none">
            <path d="M 480 88 V 112" />
            <path d="M 264 112 H 696" />
            <path d="M 264 112 V 152" marker-end="url(#arrow)" />
            <path d="M 696 112 V 152" marker-end="url(#arrow)" />

            <path d="M 264 208 V 232" />
            <path d="M 696 208 V 232" />
            <path d="M 264 232 H 696" />
            <path d="M 480 232 V 247" />
            <path d="M 264 247 H 696" />
            <path d="M 264 247 V 272" marker-end="url(#arrow)" />
            <path d="M 696 247 V 272" marker-end="url(#arrow)" />

            <path d="M 264 328 V 352" />
            <path d="M 696 328 V 352" />
            <path d="M 264 352 H 696" />
            <path d="M 480 352 V 388" marker-end="url(#arrow)" />

            <path d="M 480 444 V 488" marker-end="url(#arrow)" />
          </g>
          <g stroke="#C9CDD4" stroke-width="2" stroke-dasharray="7 6" fill="none">
            <path d="M 392 516 H 148 V 60 H 388" marker-end="url(#arrow-dash)" />
          </g>

          <!-- 并行/汇聚标注 -->
          <g font-size="11" fill="#A85400" font-weight="600">
            <text x="480" y="106" text-anchor="middle">∥ 可并行</text>
            <text x="480" y="262" text-anchor="middle">∥ 可并行</text>
            <text x="480" y="345" text-anchor="middle">汇聚</text>
          </g>

          <!-- 反馈回路标签 -->
          <g font-family="inherit">
            <text x="158" y="44" font-size="12" font-weight="700" fill="#5B6470">反馈回路 ↺</text>
            <text x="158" y="134" font-size="10" fill="#6B7480">发布后监控 → 缺陷回流至测试/需求</text>
          </g>

          <!-- 节点 -->
          <g font-family="inherit" text-anchor="middle">
            <!-- 需求 -->
            <rect x="392" y="32" width="176" height="56" rx="14" fill="#B34A00" />
            <text x="480" y="58" font-size="15" font-weight="700" fill="#fff">需求分析</text>
            <text x="480" y="75" font-size="10" fill="rgba(255,255,255,.85)">起点 · S01</text>
            <!-- 架构 -->
            <rect x="176" y="152" width="176" height="56" rx="14" fill="#FFF1E0" stroke="#E86600" stroke-width="2" />
            <text x="264" y="178" font-size="15" font-weight="700" fill="#7A3E00">架构设计</text>
            <text x="264" y="195" font-size="10" fill="#A85400">可并行 · S02</text>
            <!-- UI设计 -->
            <rect x="608" y="152" width="176" height="56" rx="14" fill="#FFF1E0" stroke="#E86600" stroke-width="2" />
            <text x="696" y="178" font-size="15" font-weight="700" fill="#7A3E00">UI 设计</text>
            <text x="696" y="195" font-size="10" fill="#A85400">可并行 · S03</text>
            <!-- 前端编码 -->
            <rect x="176" y="272" width="176" height="56" rx="14" fill="#FFF1E0" stroke="#E86600" stroke-width="2" />
            <text x="264" y="298" font-size="15" font-weight="700" fill="#7A3E00">前端编码</text>
            <text x="264" y="315" font-size="10" fill="#A85400">可并行 · S04</text>
            <!-- 后端编码 -->
            <rect x="608" y="272" width="176" height="56" rx="14" fill="#FFF1E0" stroke="#E86600" stroke-width="2" />
            <text x="696" y="298" font-size="15" font-weight="700" fill="#7A3E00">后端编码</text>
            <text x="696" y="315" font-size="10" fill="#A85400">可并行 · S05</text>
            <!-- 测试 -->
            <rect x="392" y="388" width="176" height="56" rx="14" fill="#1D2A4A" />
            <text x="480" y="414" font-size="15" font-weight="700" fill="#fff">测试</text>
            <text x="480" y="431" font-size="10" fill="rgba(255,255,255,.8)">汇聚点 · S06</text>
            <!-- 发布 -->
            <rect x="392" y="488" width="176" height="56" rx="14" fill="#1D2A4A" stroke="#E86600" stroke-width="2" />
            <text x="480" y="514" font-size="15" font-weight="700" fill="#fff">发布</text>
            <text x="480" y="531" font-size="10" fill="rgba(255,255,255,.8)">终点 · S07</text>
          </g>
        </svg>

        <div class="flow-legend">
          <span class="legend-item legend-serial">串行阶段</span>
          <span class="legend-item legend-parallel">可并行阶段</span>
          <span class="legend-item legend-join">汇聚点</span>
          <span class="legend-item legend-loop">⟳ 反馈回路</span>
        </div>
        <p class="flow-note">
          依赖说明：前端编码依赖「架构设计 + UI 设计」，后端编码依赖「架构设计」，两端以 contract-first
          契约先行并行开发；测试需两端合入后启动；发布后由 canary-watch / production-audit 观测并回哺下一轮迭代。
        </p>
      </div>
    </section>

    <!-- ===== 各阶段推荐 Skill ===== -->
    <section class="devpipeline-section" id="stage-skills" aria-labelledby="stage-skills-h2">
      <div class="devpipeline-section-head">
        <h2 id="stage-skills-h2"><span>02</span> 各阶段推荐 ECC Skills 与示例提示词</h2>
        <p>
          每个阶段 ≤5 个推荐 Skill，均来自
          <a
            href="https://github.com/affaan-m/ECC"
            target="_blank"
            rel="noopener"
            >ECC 官方仓库</a
          >，点击「示例提示词」可展开参考用法。
        </p>
      </div>

      <article v-for="stage in stages" :key="stage.id" class="stage-card" :id="stage.id">
        <header class="stage-card__head">
          <div class="stage-card__no">{{ stage.no }}</div>
          <div class="stage-card__title">
            <h3>{{ stage.name }} <small>{{ stage.en }}</small></h3>
            <p>
              <span class="phase-chip" :class="`phase-${stage.phase}`">{{ stage.phaseLabel }}</span>
              <span class="dep-note">{{ stage.dep }}</span>
            </p>
          </div>
        </header>

        <p class="stage-card__desc">{{ stage.desc }}</p>

        <div class="deliverables">
          <span class="deliverables-label">交付物</span>
          <span v-for="d in stage.deliverables" :key="d" class="deliverable-chip">{{ d }}</span>
        </div>

        <ul class="skill-list">
          <li v-for="skill in stage.skills" :key="skill.name" class="skill-item">
            <div class="skill-item__main">
              <code class="skill-name">{{ skill.name }}</code>
              <p class="skill-tagline">{{ skill.tagline }}</p>
            </div>
            <details class="skill-prompt">
              <summary>示例提示词</summary>
              <pre>{{ skill.prompt }}</pre>
            </details>
          </li>
        </ul>
      </article>
    </section>

    </div>
</template>

<style scoped>
.devpipeline-page {
  width: min(100%, 1180px);
  margin: 0 auto;
  color: #2a2118;
}

/* ---------- 泰康橙设计 Token ---------- */
.devpipeline-page {
  --tk: #ff7a00;
  --tk-deep: #e86600;
  --tk-soft: #fff1e0;
  --tk-soft-2: #ffe6c7;
  --tk-deep-2: #b34a00;
  --navy: #1d2a4a;
  --ink: #2a2118;
  --muted: #7a6a58;
}

/* ---------- 头部 ---------- */
.devpipeline-hero {
  position: relative;
  overflow: hidden;
  padding: 40px 36px 34px;
  border-radius: 20px;
  color: #fff;
  background:
    radial-gradient(120% 160% at 88% -20%, rgb(255 122 0 / 55%), transparent 55%),
    linear-gradient(135deg, #1d2a4a 0%, #24365e 62%, #2a3d66 100%);
  box-shadow: 0 18px 50px rgb(29 42 74 / 18%);
}
.devpipeline-hero::after {
  content: '';
  position: absolute;
  right: -70px;
  bottom: -110px;
  width: 300px;
  height: 300px;
  border: 2px dashed rgb(255 255 255 / 22%);
  border-radius: 50%;
}
.devpipeline-eyebrow {
  margin: 0 0 10px;
  color: var(--tk);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
}
.devpipeline-hero h1 {
  margin: 0;
  font-size: clamp(26px, 3.4vw, 38px);
  letter-spacing: -0.03em;
}
.devpipeline-lead {
  max-width: 720px;
  margin: 14px 0 0;
  color: rgb(255 255 255 / 82%);
  font-size: 14px;
  line-height: 1.75;
}
.devpipeline-lead strong {
  color: #ffb066;
}
.devpipeline-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 26px;
}
.stat {
  display: grid;
  min-width: 118px;
  padding: 12px 16px;
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 12px;
  background: rgb(255 255 255 / 8%);
  backdrop-filter: blur(4px);
}
.stat strong {
  color: var(--tk);
  font-size: 24px;
  line-height: 1.1;
}
.stat span {
  margin-top: 4px;
  color: rgb(255 255 255 / 76%);
  font-size: 11px;
}

/* ---------- 通用 section ---------- */
.devpipeline-section {
  margin-top: 34px;
}
.devpipeline-section-head h2 {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0;
  color: #2a2118;
  font-size: 20px;
  letter-spacing: -0.02em;
}
.devpipeline-section-head h2 span {
  color: var(--tk-deep-2);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.devpipeline-section-head p {
  max-width: 860px;
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.7;
}

/* ---------- 流程树 ---------- */
.devpipeline-section-head p a {
  color: var(--tk-deep-2);
  text-decoration: underline;
}
.flow-tree-card {
  margin-top: 16px;
  padding: 18px 18px 14px;
  border: 1px solid #f0e2cf;
  border-radius: 16px;
  background: #fffdf8;
}
.flow-tree {
  display: block;
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
}
.flow-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 6px;
}
.legend-item {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 650;
}
.legend-serial {
  color: #fff;
  background: var(--tk-deep-2);
}
.legend-parallel {
  color: #7a3e00;
  background: var(--tk-soft);
  border: 1px solid #ffc98f;
}
.legend-join {
  color: #fff;
  background: var(--navy);
}
.legend-loop {
  color: #5b6470;
  background: #eef0f3;
}
.flow-note {
  margin: 12px auto 0;
  max-width: 860px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.75;
  text-align: center;
}

/* ---------- 阶段卡片 ---------- */
.stage-card {
  margin-top: 16px;
  padding: 20px 22px 16px;
  border: 1px solid #f0e2cf;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 2px 10px rgb(122 62 0 / 5%);
}
.stage-card__head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.stage-card__no {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  place-items: center;
  border-radius: 11px;
  color: #fff;
  background: linear-gradient(135deg, var(--tk) 0%, var(--tk-deep) 100%);
  font-size: 15px;
  font-weight: 800;
}
.stage-card__title h3 {
  margin: 0;
  font-size: 17px;
  letter-spacing: -0.015em;
}
.stage-card__title h3 small {
  margin-left: 6px;
  color: #7a6a58;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.stage-card__title p {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 7px 0 0;
}
.phase-chip {
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 750;
}
.phase-serial {
  color: #fff;
  background: var(--tk-deep-2);
}
.phase-parallel {
  color: #7a3e00;
  background: var(--tk-soft);
  border: 1px solid #ffc98f;
}
.phase-join {
  color: #fff;
  background: var(--navy);
}
.phase-end {
  color: #fff;
  background: #26334f;
  border: 1px solid #ffc98f;
}
.dep-note {
  color: #7a6a58;
  font-size: 11px;
}
.stage-card__desc {
  margin: 14px 0 0;
  color: #4c4135;
  font-size: 13px;
  line-height: 1.75;
}
.deliverables {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
}
.deliverables-label {
  margin-right: 2px;
  color: #b0251f;
  font-size: 11px;
  font-weight: 750;
}
.deliverable-chip {
  padding: 3px 8px;
  border-radius: 6px;
  color: #7a3e00;
  background: var(--tk-soft-2);
  font-size: 11px;
}

/* ---------- skill 列表 ---------- */
.skill-list {
  display: grid;
  gap: 8px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}
.skill-item {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid #f3e8d8;
  border-radius: 12px;
  background: #fffaf3;
}
.skill-item__main {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
}
.skill-name {
  padding: 2px 7px;
  border-radius: 6px;
  color: #b0251f;
  background: #fdebe0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  font-weight: 700;
}
.skill-tagline {
  margin: 0;
  color: #6b5c4c;
  font-size: 12px;
}
.skill-prompt summary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tk-deep-2);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  user-select: none;
  border-radius: 4px;
}
.skill-prompt summary:focus-visible {
  outline: 2px solid var(--tk-deep-2);
  outline-offset: 2px;
}
.skill-prompt summary::before {
  content: '▶';
  font-size: 9px;
  transition: transform 0.15s ease;
}
.skill-prompt[open] summary::before {
  transform: rotate(90deg);
}
.skill-prompt pre {
  margin: 10px 0 2px;
  padding: 12px 14px;
  overflow-x: auto;
  border-radius: 10px;
  color: #f6e9d8;
  background: #33261a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>