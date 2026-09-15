import type { SkillCategory } from '../../types/skill'

export interface FlowCategory {
  key: string
  fallbackName: string
}

export interface FlowNode {
  id: string
  no: string
  name: string
  en: string
  tone: 'requirement' | 'product' | 'architecture' | 'ui' | 'backend' | 'frontend' | 'security' | 'testing' | 'deployment'
  phaseLabel: string
  dependency: string
  description: string
  categories: FlowCategory[]
}

export interface SkillRecommendation {
  skillKey: string
  tagline: string
  prompt: string
  categoryKey: string
  required: boolean
  condition?: string
  artifact: string
  reusedIn?: string
}

export interface RecommendationSection {
  id: string
  no: string
  name: string
  en: string
  phaseLabel: string
  description: string
  deliverables: string[]
  steps?: RecommendationStep[]
  subsections?: RecommendationSubsection[]
}

export interface RecommendationStep {
  id: string
  no: string
  label: string
  description?: string
  relation?: 'alternative'
  skills: SkillRecommendation[]
}

export interface RecommendationSubsection {
  id: string
  name: string
  en: string
  description: string
  steps: RecommendationStep[]
}

export const flowNodes: FlowNode[] = [
  {
    id: 'requirements',
    no: '01',
    name: '需求',
    en: 'Requirements',
    tone: 'requirement',
    phaseLabel: '串行起点',
    dependency: '从业务问题开始，冻结范围与验收口径',
    description: '从问题、用户和约束出发，形成可验证的需求基线。',
    categories: [
      { key: 'requirement.discovery', fallbackName: '需求发现与澄清' },
      { key: 'requirement.analysis', fallbackName: '需求分析与验收标准' },
      { key: 'requirement.planning', fallbackName: '计划拆解与任务编排' },
    ],
  },
  {
    id: 'product',
    no: '02',
    name: '产品',
    en: 'Product',
    tone: 'product',
    phaseLabel: '价值确认',
    dependency: '依赖需求基线，确认 MVP、指标与边界',
    description: '验证是否值得做、为谁做以及怎样衡量成功，形成产品和研发交付契约。',
    categories: [
      { key: 'product.strategy', fallbackName: '产品战略与能力规划' },
      { key: 'product.knowledge', fallbackName: '文档与知识管理' },
    ],
  },
  {
    id: 'architecture',
    no: '03',
    name: '架构设计',
    en: 'Architecture',
    tone: 'architecture',
    phaseLabel: '并行支线 A',
    dependency: '与 UI 设计并行，需求基线需已冻结',
    description: '确定系统边界、关键接口和架构决策，为前后端编码提供稳定契约。',
    categories: [
      { key: 'architecture.system', fallbackName: '系统与服务架构' },
      { key: 'architecture.governance', fallbackName: 'ADR 与架构治理' },
      { key: 'architecture.integration', fallbackName: 'API、MCP 与系统集成' },
    ],
  },
  {
    id: 'ui',
    no: '04',
    name: 'UI 设计',
    en: 'UI Design',
    tone: 'ui',
    phaseLabel: '并行支线 B',
    dependency: '与架构设计并行，基于 PRD 确认页面状态',
    description: '建立视觉方向、设计系统和交互原型，明确关键流程及异常状态。',
    categories: [
      { key: 'ui.visual', fallbackName: '视觉与设计系统' },
      { key: 'ui.delivery', fallbackName: '原型、演示与设计交付' },
      { key: 'ui.accessibility', fallbackName: '无障碍设计' },
      { key: 'ui.ux', fallbackName: '用户体验与交互设计' },
    ],
  },
  {
    id: 'backend',
    no: '05',
    name: '后端编码',
    en: 'Backend Coding',
    tone: 'backend',
    phaseLabel: '对应架构设计',
    dependency: '依赖架构契约，与前端编码并行',
    description: '按接口、数据和安全约束实现业务服务，持续用测试和证据验证行为。',
    categories: [
      { key: 'backend.api', fallbackName: 'API 与连接器开发' },
      { key: 'backend.jvm', fallbackName: 'Java 与 JVM' },
    ],
  },
  {
    id: 'frontend',
    no: '06',
    name: '前端编码',
    en: 'Frontend Coding',
    tone: 'frontend',
    phaseLabel: '对应 UI 设计',
    dependency: '依赖架构契约 + UI 设计，与后端编码并行',
    description: '把已确认的页面和交互转为可维护组件，保持类型、状态和 API 契约一致。',
    categories: [
      { key: 'frontend.engineering', fallbackName: '前端状态、性能与工程化' },
      { key: 'frontend.react', fallbackName: 'React 与 Next.js' },
    ],
  },
  {
    id: 'security',
    no: '07',
    name: '安全审核',
    en: 'Security Review',
    tone: 'security',
    phaseLabel: '发布前门禁',
    dependency: '实现版本和配置具备可审计证据',
    description: '覆盖应用代码、认证授权、Agent 配置、依赖、密钥和供应链风险。',
    categories: [
      { key: 'security.application', fallbackName: '应用安全、认证与授权' },
      { key: 'security.agent', fallbackName: 'Agent、MCP 与 LLM 安全' },
      { key: 'security.supply_chain', fallbackName: '代码、依赖与供应链安全' },
    ],
  },
  {
    id: 'testing',
    no: '08',
    name: '测试',
    en: 'Testing',
    tone: 'testing',
    phaseLabel: '两端合入后汇聚',
    dependency: '前后端实现完成，安全风险已处理或明确接受',
    description: '从单元、组件、E2E 到质量门禁汇总真实证据，给出可发布结论。',
    categories: [
      { key: 'testing.unit', fallbackName: '单元测试' },
      { key: 'testing.component', fallbackName: '组件与 UI 测试' },
      { key: 'testing.web_e2e', fallbackName: 'Web E2E' },
      { key: 'testing.quality_gate', fallbackName: '覆盖率/验证循环/质量门禁' },
    ],
  },
  {
    id: 'deployment',
    no: '09',
    name: '部署',
    en: 'Deployment',
    tone: 'deployment',
    phaseLabel: '发布与反馈',
    dependency: '测试门禁通过，具备可追踪制品和回滚方案',
    description: '完成 CI/CD、发布、观测和回滚，并将线上事实回流到下一轮研发。',
    categories: [
      { key: 'deployment.cicd', fallbackName: 'CI/CD 与发布流水线' },
      { key: 'deployment.operations', fallbackName: '故障响应与运行维护' },
    ],
  },
]

const s = (
  skillKey: string,
  tagline: string,
  categoryKey: string,
  prompt: string,
  artifact: string,
  required = true,
  condition?: string,
  reusedIn?: string,
): SkillRecommendation => ({ skillKey, tagline, categoryKey, prompt, artifact, required, condition, reusedIn })

const step = (
  id: string,
  no: string,
  label: string,
  skills: SkillRecommendation[],
  description?: string,
  relation?: 'alternative',
): RecommendationStep => ({ id, no, label, skills, description, relation })

export const recommendationSections: RecommendationSection[] = [
  {
    id: 'requirements', no: '01', name: '需求', en: 'Requirements', phaseLabel: '先把问题说清楚',
    description: '从 SecondShelf 的初始想法开始，先澄清范围，再把意图转换为可验证的需求基线。',
    deliverables: ['brief.md', '验收条件', 'requirements.md'],
    steps: [
      step('brainstorming', '1', '澄清问题与范围', [s('brainstorming', '结构化澄清用户、范围、规则和替代方案', 'requirement.discovery', '使用 brainstorming 技能，阅读 examples/used-book-marketplace/inputs/brief.md，澄清 SecondShelf 的用户、业务规则、范围、风险和替代方案，不设计实现，输出可评审的产品概念。', '批准后的产品概念与范围边界', true)]),
      step('intent-driven-development', '2', '形成验收条件', [s('intent-driven-development', '把业务意图转换为稳定、可验证的验收条件', 'requirement.analysis', '使用 intent-driven-development 技能，把 SecondShelf 的“发布二手书”和“提交购买意向”拆成稳定的 REQ/AC 编号，区分事实、假设，并为每条验收条件给出通过/失败示例。', 'REQ/AC 验收条件清单', true)]),
      step('requirements-specification', '3', '生成需求说明书', [s('requirements-specification', '按用户模板生成可追溯的软件需求说明书', 'requirement.analysis', '使用 requirements-specification 技能，读取 examples/used-book-marketplace/templates/requirements-template.md、inputs/brief.md 和已批准的验收条件，生成 docs/requirements/second-shelf-requirements.md 及合规报告。', 'docs/requirements/second-shelf-requirements.md', true)]),
    ],
  },
  {
    id: 'product', no: '02', name: '产品', en: 'Product', phaseLabel: '确认价值和边界',
    description: '用产品视角审查问题，再把批准后的需求整理成 PRD 和研发能力契约。',
    deliverables: ['PRD', '能力契约', '成功指标', '范围与非目标'],
    steps: [
      step('product-lens', '1', '验证问题与 MVP 边界', [s('product-lens', '审查问题、用户、价值、证据和最小可行范围', 'product.strategy', '使用 product-lens 技能审查 SecondShelf 的问题、用户、证据、成功指标和 MVP 边界，明确“不含真实付款、物流、聊天和推荐”的非目标。', '产品诊断与 MVP 决策', true)]),
      step('prd-authoring', '2', '编写 PRD', [s('prd-authoring', '根据需求基线生成问题导向的 PRD', 'product.strategy', '使用 prd-authoring 技能，套用 examples/used-book-marketplace/templates/prd-template.md，根据批准的需求和 product-lens 结论生成 SecondShelf PRD，保留 REQ 追踪关系。', 'docs/product/second-shelf-prd.md', true)]),
      step('product-capability', '3', '形成研发能力契约', [s('product-capability', '把 PRD 转换为约束、不变量和交付契约', 'product.strategy', '使用 product-capability 技能，把 SecondShelf PRD 转换为研发能力契约，明确“只有卖家能管理自己的书”“已售书籍不能新增购买意向”“不接入支付”的不变量。', 'docs/product/second-shelf-capability.md', true)]),
    ],
  },
  {
    id: 'architecture-ui', no: '03-04', name: '架构与 UI 设计', en: 'Architecture + UI', phaseLabel: '两条设计支线并行',
    description: '架构和 UI 共同消费已批准的产品基线；一条确定系统边界，一条确定用户体验和页面状态。',
    deliverables: ['HLD/ADR', '接口契约', '设计系统', 'Stitch 页面流'],
    subsections: [
      {
        id: 'architecture', name: '架构设计', en: 'Architecture', description: '定义系统边界、接口契约和需要长期保留的架构决策。', steps: [
      step('architecture-baseline', '1', '建立架构基线', [
        s('high-level-design', '生成带架构图、边界和质量属性的 HLD', 'architecture.system', '使用 high-level-design 技能，读取 requirements、PRD 和 capability contract，套用 hld-template.md，为 SecondShelf 生成系统上下文、容器、购买意向流程和部署拓扑 Mermaid 图。', 'docs/architecture/second-shelf-hld.md', true),
        s('architecture-blueprint-generator', '从既有代码生成架构蓝图和实现约束', 'architecture.system', '使用 architecture-blueprint-generator 技能检查 SecondShelf 示例仓库，生成技术栈、模块关系、架构图和实现约束，并标出与 HLD 的差异。', '架构蓝图与差异清单', false, '仅在已有代码需要反向整理时使用'),
      ], '新系统使用 HLD；已有代码需要反向整理时使用架构蓝图生成器。', 'alternative'),
      step('architecture-decision-records', '2', '记录关键架构决策', [s('architecture-decision-records', '沉淀技术选型、备选方案和后果', 'architecture.governance', '使用 architecture-decision-records 技能，为 SecondShelf 的 PostgreSQL、REST 和 monolith-first 方案记录背景、备选方案、取舍理由和长期影响。', 'ADR 日志', true)]),
      step('api-design', '3', '定义接口契约', [s('api-design', '设计一致、可演进、可验证的服务接口', 'architecture.integration', '使用 api-design 技能为 SecondShelf 的发布书籍和提交购买意向设计 REST API，明确资源命名、状态码、错误体、权限、分页和版本策略。', 'API 契约与错误模型', true)]),
        ] },
        {
        id: 'ui-design', name: 'UI 设计', en: 'UI Design', description: '从视觉方向到高保真页面流，明确所有关键交互和状态。', steps: [
      step('frontend-design', '1', '确定视觉方向', [s('frontend-design', '确定有辨识度且可落地的视觉方向', 'ui.visual', '使用 frontend-design 技能，根据 SecondShelf PRD 确定市场浏览、书籍详情、发布书籍和购买意向页面的视觉方向、排版、色彩和交互语言。', '.design/second-shelf-DESIGN.md', true)]),
      step('stitch-manage-design-system', '2', '维护设计系统', [s('stitch-manage-design-system', '在 Stitch 中维护项目级设计系统', 'ui.visual', '使用 stitch-manage-design-system 技能，将 SecondShelf 的 DESIGN.md 应用到已确认的 Stitch 项目，统一颜色、字体、间距、组件和状态。', 'Stitch 项目级 DESIGN.md', true, '需要可用的 Stitch MCP 项目')]),
      step('stitch-generate-design', '3', '生成页面原型与交互流', [s('stitch-generate-design', '根据需求生成页面原型、状态和交互流', 'ui.delivery', '使用 stitch-generate-design 技能，为 SecondShelf 生成浏览、详情、发布书籍、提交购买意向页面，并覆盖加载、校验、空、错误和权限状态。', 'Stitch 页面 ID 与连接流', true, '需要可用的 Stitch MCP 项目')]),
      step('accessibility', '4', '建立无障碍基线', [s('accessibility', '按 WCAG 2.2 AA 检查键盘、对比度和读屏语义', 'ui.accessibility', '使用 accessibility 技能审查 SecondShelf 页面：检查键盘可达、色彩对比、焦点管理、表单标签和读屏器语义，输出问题清单与修复建议。', '无障碍检查清单', true, undefined, '详细设计和候选版本 QA 阶段复用')]),
        ] },
    ],
  },
  {
    id: 'design-plan', no: '05-06', name: '详细设计与实施计划', en: 'Detailed Design + Plan', phaseLabel: '编码前形成可执行清单',
    description: '把架构、页面和接口基线落成前后端详细设计，再拆成可以逐项验证的实施任务。',
    deliverables: ['后端详细设计', '前端详细设计', '交付清单', '实施计划'],
    subsections: [
      {
        id: 'detailed-design', name: '详细设计', en: 'Detailed Design', description: '将批准的需求、架构、页面和接口转成前后端可实施设计。', steps: [
      step('backend-detailed-design', '1', '完成后端详细设计', [s('backend-detailed-design', '按模板生成可直接实施的后端设计', 'backend.api', '使用 backend-detailed-design 技能，结合需求、PRD、HLD、ADR 和模板，完整设计 SecondShelf 的发布书籍和提交购买意向两个后端切片。', 'docs/design/second-shelf-backend.md', true)]),
      step('springboot-patterns', '2', '固化后端实现约束', [s('springboot-patterns', '指导 Spring Boot 分层、事务、持久化和日志', 'backend.jvm', '使用 springboot-patterns 技能评审 SecondShelf 后端的 Controller、Service、Repository、事务、数据访问、缓存、异步和日志边界。', 'Spring Boot 实现约束', true, undefined, '后端编码阶段复用')]),
      step('frontend-detailed-design', '3', '完成前端详细设计', [s('frontend-detailed-design', '从 PRD、HLD 和原型生成前端详细设计', 'frontend.engineering', '使用 frontend-detailed-design 技能，读取 SecondShelf 的批准页面 ID、PRD、HLD 和模板，设计路由、组件树、状态、接口映射、异常状态和测试追踪。', 'docs/design/second-shelf-frontend.md', true)]),
      step('frontend-patterns', '4', '固化前端实现约束', [s('frontend-patterns', '指导组件、状态管理、请求和性能工程', 'frontend.engineering', '使用 frontend-patterns 技能为 SecondShelf 设计浏览列表、书籍详情和发布表单的组件边界、状态管理、请求缓存、错误处理和性能策略。', '前端组件与工程约束', true, undefined, '前端编码阶段复用')]),
        ] },
        {
          id: 'implementation-plan', name: '实施计划', en: 'Implementation Plan', description: '把批准文档拆成可追踪、可测试、可以逐项验收的开发任务。', steps: [
      step('implementation-planning', '1', '拆解实施任务', [s('implementation-planning', '把批准文档拆成可追踪、可测试的任务', 'requirement.planning', '使用 implementation-planning 技能，根据 SecondShelf 的批准交付清单生成 .plans/second-shelf.plan.md，让每个任务关联 REQ、AC、HLD、详细设计、Screen ID 和 TEST ID。', '.plans/second-shelf.plan.md', true)]),
        ] },
    ],
  },
  {
    id: 'coding', no: '07', name: '后端与前端编码', en: 'Implementation', phaseLabel: '两端并行实现',
    description: '按批准计划逐个完成垂直切片，用测试先行、设计追踪和真实证据控制实现质量。',
    deliverables: ['可运行代码', 'TDD 证据', '组件测试', '垂直切片'],
    subsections: [
      {
        id: 'backend-coding', name: '后端编码', en: 'Backend Coding', description: '以发布书籍和购买意向为垂直切片，先测后码并保留服务端证据。', steps: [
      step('tdd-workflow', '1', '执行 TDD 循环', [s('tdd-workflow', '以 RED、GREEN、REFACTOR 循环保留开发证据', 'testing.quality_gate', '使用 tdd-workflow 技能，按 .plans/second-shelf.plan.md 先为发布书籍切片写失败测试，再实现最小代码、验证通过并记录 RED/GREEN/REFACTOR 证据。', 'TDD 证据报告', true)]),
      step('springboot-tdd', '2', '完成 Spring Boot 测试', [s('springboot-tdd', '用 JUnit、MockMvc 和 Testcontainers 验证 Spring Boot', 'testing.unit', '使用 springboot-tdd 技能为 SecondShelf 的发布书籍和购买意向接口编写 JUnit 5、MockMvc、集成和 Testcontainers 测试，覆盖卖家权限和已售书籍规则。', '后端单元/集成测试', true)]),
        ] },
        {
          id: 'frontend-coding', name: '前端编码', en: 'Frontend Coding', description: '将批准的页面原型实现为组件，并用行为测试验证交互和状态。', steps: [
      step('stitch-react-components', '1', '实现 React 页面组件', [s('stitch-react-components', '把批准的原型转换成可维护 React 组件', 'frontend.react', '使用 stitch-react-components 技能，将已批准的 SecondShelf 发布书籍和购买意向 Stitch 页面转换为 React 组件，并保留 Screen ID、设计 Token 和行为追踪。', 'React 页面组件', true, '需要已批准的 Stitch 页面')]),
      step('react-testing', '2', '验证组件行为', [s('react-testing', '以行为和无障碍断言测试 React 组件', 'testing.component', '使用 react-testing 技能测试 SecondShelf 发布表单、书籍详情和购买意向组件：覆盖网络错误、表单校验、权限状态和无障碍断言。', '组件测试与网络 Mock', true)]),
        ] },
    ],
  },
  {
    id: 'security', no: '08', name: '安全审核', en: 'Security', phaseLabel: '发布前风险门禁',
    description: '对实现版本进行应用安全和 Agent 配置安全审核，所有高风险问题必须关闭或完成正式风险接受。',
    deliverables: ['安全报告', '风险分级', '修复与复测', '风险接受记录'],
    steps: [
      step('security-review', '1', '审查应用安全与业务风险', [s('security-review', '追踪数据流、权限和业务逻辑风险', 'security.application', '使用 security-review 技能审查 SecondShelf 实现，重点检查卖家所有权、已售状态、未授权写入、输入校验、注入、认证和敏感数据流，并按模板输出带证据报告。', 'reports/security.md', true, undefined, '实现阶段可提前用于安全敏感任务')]),
      step('springboot-security', '2', '核验服务端安全配置', [s('springboot-security', '指导认证、授权、校验、CSRF 和密钥保护', 'security.application', '使用 springboot-security 技能审查 SecondShelf Spring Boot 服务的认证、角色授权、输入校验、CSRF、响应头、限流和密钥配置。', 'Spring Security 修复清单', true)]),
      step('security-scan', '3', '扫描 Agent 与供应链配置', [s('security-scan', '审计 Agent、Skill、MCP、Hook 和工作区配置', 'security.agent', '使用 security-scan 技能扫描 SecondShelf 演示环境及其 Agent/Skill 配置，检查权限、MCP、Hook、密钥和跨平台脚本风险。', 'Agent 配置安全报告', false, '仅在存在 Agent、Skill 或 MCP 配置时使用')]),
    ],
  },
  {
    id: 'testing', no: '09', name: '测试与验收', en: 'Testing + QA', phaseLabel: '证据汇聚和发布结论',
    description: '执行维护型 E2E 和候选环境 QA，汇总所有测试证据；缺失证据必须明确标记为 NOT RUN。',
    deliverables: ['Playwright 报告', '截图/Trace', 'QA 结论', '测试汇总报告'],
    steps: [
      step('e2e-testing', '1', '执行关键旅程 E2E', [s('e2e-testing', '用 Playwright 和页面对象覆盖关键业务旅程', 'testing.web_e2e', '使用 e2e-testing 技能为 SecondShelf 编写“登录 → 浏览书籍 → 发布书籍 → 提交购买意向”的 Playwright 测试，使用 POM 并保存截图、视频和 Trace。', 'Playwright E2E 产物', true)]),
      step('webapp-testing', '2', '探索与复现问题', [s('webapp-testing', '通过浏览器探索、截图和日志定位问题', 'testing.web_e2e', '使用 webapp-testing 技能在候选环境探索 SecondShelf 的发布和购买意向流程，复现页面问题，保留浏览器日志、失败截图和最小复现步骤。', '探索性测试记录', false, '用于故障复现和专项诊断')]),
      step('browser-qa', '3', '完成候选环境 QA', [s('browser-qa', '在候选环境验证功能、视觉和交互', 'testing.web_e2e', '使用 browser-qa 技能验收 SecondShelf 候选部署：检查关键功能、视觉渲染、交互状态、失败截图和控制台错误，输出 SHIP、SHIP WITH FIXES 或 DO NOT SHIP。', '浏览器 QA 报告', true)]),
      step('web-design-guidelines', '4', '检查 Web 体验质量', [s('web-design-guidelines', '按现代 Web 规范审查视觉、交互和体验', 'ui.ux', '使用 web-design-guidelines 技能审查 SecondShelf 的列表、详情和表单页面，覆盖布局层级、反馈、加载、空状态、错误状态和无障碍体验。', 'Web 体验审查报告', true)]),
      step('test-report-consolidator', '5', '汇总测试证据', [s('test-report-consolidator', '汇总单元、集成、组件、E2E 和 QA 证据', 'testing.quality_gate', '使用 test-report-consolidator 技能，套用 examples/used-book-marketplace/templates/test-report-template.md，汇总 SecondShelf 的真实测试结果并建立 REQ/Task/TEST 追踪。', 'reports/test-report.md', true)]),
      step('verification-loop', '6', '形成发布验证结论', [s('verification-loop', '统一验证构建、类型、规范、测试、安全和差异', 'testing.quality_gate', '使用 verification-loop 技能在 SecondShelf 发布前执行构建、类型检查、Lint、测试、安全和 Git diff 核对，输出带新鲜命令证据的发布验证报告。', 'reports/release-verification.md', true)]),
    ],
  },
  {
    id: 'deployment', no: '10', name: '部署与持续维护', en: 'Deployment + Feedback', phaseLabel: '发布、观测、回流',
    description: '把通过验收的版本变成可追踪制品，配置最小权限发布身份、健康检查和回滚，并维护 as-built 文档。',
    deliverables: ['CI/CD 方案', '发布与回滚手册', '运行观测', 'As-built 文档'],
    steps: [
      step('deployment-patterns', '1', '设计发布与回滚方案', [s('deployment-patterns', '提供 CI/CD、容器、健康检查和回滚实践', 'deployment.cicd', '使用 deployment-patterns 技能为 SecondShelf 设计 CI/CD 与回滚手册：构建、测试、制品、环境审批、健康检查、灰度和回滚。', 'CI/CD 设计与回滚手册', true)]),
      step('github-actions-hardening', '2', '加固 CI/CD 工作流', [s('github-actions-hardening', '审查工作流注入、权限、Action 和密钥风险', 'security.supply_chain', '使用 github-actions-hardening 技能审查 SecondShelf 的 GitHub Actions：触发器、表达式注入、权限、第三方 Action 引用、Secrets 和部署身份。', 'GitHub Actions 安全审查', true, '使用 GitHub Actions 时必选')]),
      step('github-ops', '3', '执行发布运营', [s('github-ops', '通过 gh CLI 管理 CI、发布和仓库运营', 'deployment.operations', '使用 github-ops 技能检查 SecondShelf 的 CI 状态、PR、发布、Dependabot 和仓库安全运营，定位失败运行并记录发布结果。', 'CI/发布运营记录', false, '需要 GitHub 仓库和 gh CLI')]),
      step('oo-component-documentation', '4', '沉淀 as-built 文档', [s('oo-component-documentation', '把实现后的组件事实沉淀为 as-built 文档', 'product.knowledge', '使用 oo-component-documentation 技能在 SecondShelf 两个垂直切片完成后，依据实际代码补充组件职责、接口、依赖和使用方式，不改写已批准的产品和架构决策。', '组件 as-built 文档', false, '实现完成后按文档维护需要使用')]),
    ],
  },
]

export const allRecommendations = recommendationSections.flatMap((section) => (
  section.subsections?.flatMap((subsection) => subsection.steps.flatMap((item) => item.skills))
  || section.steps?.flatMap((item) => item.skills)
  || []
))

export function categoryName(category: SkillCategory | undefined, fallback: string): string {
  return category?.name || fallback
}
