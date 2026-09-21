/**
 * Mock 产物与剧本内容（mock/dev-pipeline-demo 专用）。
 * 所有文档 markdown、代码片段、测试用例、部署清单均严格对齐 run 31 真实业务
 * 「销售沟通记录与管理工具」及其前序产物（需求 V0.2 / PRD V1.0 / 架构设计 V1.0 / UI 设计 V1.0），
 * 引用其真实编号（PRD-F / AC / ARCH-C / ARCH-T / AD），保证录制时点开产物可追溯、可通读。
 *
 * 这些内容在前端 mock 引擎到达对应节点时，通过既有文档创建 API 真实入库，得到可打开的真实 documentId。
 */

/* ========== 编码阶段 · 详细设计文档（详细设计 agent 产出） ========== */
export const DETAILED_DESIGN_DOC = `# 销售沟通记录与管理工具 — 详细设计文档

## 1. 文档信息

| 项目 | 内容 |
|---|---|
| 文档名称 | 销售沟通记录与管理工具 详细设计文档 |
| 文档版本 | V1.0（DRAFT） |
| 文档状态 | DRAFT |
| 编写日期 | 2026-09-21 |
| 编写角色 | 详细设计 Agent |
| 上游文档 | 《架构设计文档》V1.0（documentId=18 / revisionId=24）；《PRD》V1.0（documentId=16 / revisionId=22） |
| 适用范围 | 首期最小闭环：销售录入 → AI 结构化整理 → 数据保存 → 看板展示 |

> 本设计把架构文档中的组件（ARCH-C-01~09）展开为可编码的类 / 方法 / SQL / 接口契约，编号沿用架构追溯约定。

---

## 2. 模块与类设计

### 2.1 接入层 IngestionController（ARCH-C-01）

\`\`\`
@RestController
public class IngestionController {
    // ARCH-I-01：飞书事件订阅回调
    POST /webhook/feishu/events
        ├─ verifySignature(encryptKey, timestamp, nonce, body)   // 验签，防伪造录入
        ├─ 若是 url_verification：回显 challenge（握手）
        └─ 若是 im.message.receive_v1：
             ├─ 非文本消息 → ReceiptService.replyGuide("请用文字描述本次沟通情况")
             └─ 文本消息 → RecordService.ingest(salesUserId, rawText, messageId)  // 原文先入库
}
\`\`\`

**幂等设计**：以飞书 \`message_id\` 建唯一约束去重，重复回调直接返回 200 不重复入库（对应架构风险表「回调重复推送」）。

### 2.2 记录服务 RecordService（ARCH-C-02）

\`\`\`
@Service
public class RecordService {
    /** 原文先入库（PRD-F-002 / AC-002）：任何后续环节失败均不得丢原文。 */
    @Transactional
    public CommunicationRecord ingest(String salesUserId, String rawText, String messageId) {
        // 1. 幂等校验 messageId
        // 2. INSERT communication_record(status=PENDING, submitted_at=now())
        // 3. 投递 extraction_task(QUEUED)
        // 4. 同步返回，由 ReceiptService 发「接收回执」≤3s
    }

    /** 状态机流转（PRD 5.2）：PENDING → PROCESSED / FAILED / INCOMPLETE */
    public void applyResult(Long recordId, ExtractionResult r) { /* 见 2.3 */ }

    /** 失败重试入口（PRD-F-005）：指数退避，最多 3 次 */
    public void reextract(Long recordId) { /* 置回 PENDING，重建 task */ }
}
\`\`\`

### 2.3 AI 整理服务 ExtractionService（ARCH-C-03）— 本次编码核心

调用**公司统一大模型网关**（AD-01）做六要素抽取，强制 JSON 输出，字段校验失败进入重试。代码片段见「编码过程」窗口（\`ExtractionService.extractSixElements\`）。

### 2.4 回执服务 ReceiptService（ARCH-C-04）

- 接收回执：录入即回，文案「已记录 ✅」；
- 结果回执（PRD-F-006）：\`已记录 ✅｜客户：{customer_name}｜主题：{topic}\`；关键字段缺失追加「未识别到{字段名}，可补充说明」；AI 失败回「已接收，稍后完成整理 ⏳」。

### 2.5 任务调度 TaskWorker（ARCH-C-05）

- 轮询 \`extraction_task\` 表取 QUEUED 任务 → 调 ExtractionService；
- 指数退避重试 1min → 5min → 15min，retry_count 上限 3，耗尽置 FAILED（死信可见）；
- 重启不丢任务（DB 持久化，AD-04）。

### 2.6 看板查询服务 DashboardQueryService（ARCH-C-06，只读）

| 接口（ARCH-I） | 方法 | 说明 |
|---|---|---|
| ARCH-I-10 | GET /api/v1/dashboard/summary?date= | 当日沟通总次数 COUNT(*)、已提交销售人数 COUNT(DISTINCT sales_user_id) |
| ARCH-I-11 | GET /api/v1/records?date=&page=&size= | 分页摘要，按 submitted_at DESC |
| ARCH-I-12 | GET /api/v1/records/{id} | 原文 + 六要素对照详情 |
| ARCH-I-13 | POST /api/v1/records/{id}/reextract | 识别失败记录手动重新识别（仅管理） |

### 2.7 认证鉴权模块 AuthModule（ARCH-C-07，AD-02）

飞书 OAuth 2.0 网页授权 → 换取 user_id → 比对 \`manager_whitelist\` → 签发 HttpOnly+Secure+SameSite 会话（存 Redis，8h 过期）。所有 \`/api/v1/**\` 经会话拦截器，未登录 401、非管理 403。

---

## 3. 数据表 DDL（PostgreSQL，对应 ARCH-T）

\`\`\`sql
CREATE TABLE communication_record (
    record_id      UUID PRIMARY KEY,
    sales_user_id  VARCHAR(64)  NOT NULL,
    sales_name     VARCHAR(128) NOT NULL,
    raw_text       TEXT         NOT NULL,
    customer_name  VARCHAR(256) NULL,
    topic          VARCHAR(512) NULL,
    customer_focus TEXT         NULL,
    intention      VARCHAR(512) NULL,
    issues         TEXT         NULL,
    next_plan      TEXT         NULL,
    status         VARCHAR(16)  NOT NULL,  -- PENDING/PROCESSED/FAILED/INCOMPLETE
    ext_fields     JSONB        NULL,      -- AC-016 扩展字段，无破坏性变更
    submitted_at   TIMESTAMPTZ  NOT NULL,
    processed_at   TIMESTAMPTZ  NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_record_submitted ON communication_record (submitted_at DESC);
CREATE INDEX idx_record_sales ON communication_record (sales_user_id, submitted_at);
CREATE INDEX idx_record_status ON communication_record (status);

CREATE TABLE extraction_task (
    task_id       UUID PRIMARY KEY,
    record_id     UUID NOT NULL REFERENCES communication_record(record_id),
    status        VARCHAR(16) NOT NULL,     -- QUEUED/RUNNING/DONE/FAILED
    retry_count   INT NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ NULL,
    last_error    TEXT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE manager_whitelist (
    id             BIGSERIAL PRIMARY KEY,
    feishu_user_id VARCHAR(64) UNIQUE NOT NULL,
    name           VARCHAR(128),
    enabled        BOOLEAN NOT NULL DEFAULT TRUE
);
\`\`\`

---

## 4. AI 抽取契约（ARCH-I-03）

- **请求**：\`POST {gateway}/chat/completions\`，body 含系统提示词（六要素抽取指令 + 字段定义 + 「无法识别返回 null」规则）+ raw_text；\`response_format=json\`；超时 30s。
- **响应 JSON**：\`{customer_name, topic, customer_focus, intention, issues, next_plan}\`（字符串或 null）。
- **失败判定**：HTTP 异常 / 超时 / JSON 解析失败 / 字段非法 → 进入 TaskWorker 重试（PRD-F-003 业务规则）。

---

## 5. 状态机与异常处理

| 状态 | 触发 | 看板展示 |
|---|---|---|
| PENDING | 入库初始态 | 蓝色「待处理」 |
| PROCESSED | AI 返回合法 JSON 且关键字段齐全 | 默认「成功」 |
| INCOMPLETE | AI 成功但客户名称为空 | 橙色「待补充」 |
| FAILED | AI 异常且重试耗尽 | 红色「识别失败」，提供「重新识别」 |

---

## 6. 安全要点（对应架构第 8 章）

1. 飞书回调验签（Encrypt Key/Verification Token）；
2. 全链路 HTTPS，Nginx 终结 TLS；
3. 会话 Cookie HttpOnly+Secure+SameSite，Redis 存储；
4. 客户沟通文本仅经公司统一大模型网关出域（AD-01），不直连公网模型；
5. 敏感配置（App Secret / 网关密钥 / DB 密码）走环境变量，不入库不入仓。

---

*本详细设计由 详细设计 Agent 依据《架构设计文档》V1.0（documentId=18/revisionId=24）起草，供编码 Agent 实现。*
`;

/* ========== 测试阶段 · 测试用例文档（用例设计 agent 产出） ========== */
export const TEST_CASES_DOC = `# 销售沟通记录与管理工具 — 测试用例

## 1. 文档信息

| 项目 | 内容 |
|---|---|
| 文档名称 | 销售沟通记录与管理工具 测试用例 |
| 文档版本 | V1.0 |
| 编写日期 | 2026-09-21 |
| 编写角色 | 测试用例设计 Agent |
| 依据 | 《PRD》V1.0 第 13 章验收标准（AC-001~AC-018）；《详细设计文档》V1.0 |

> 用例编号 TC-AC-xxx 与 PRD 验收条目一一对应；状态色约定：成功=默认、待处理=蓝、识别失败=红、待补充=橙。

---

## 2. 测试用例表（首期 P0 范围）

| 用例编号 | 用例标题 | 前置条件 | 测试步骤 | 预期结果 | 对应 AC |
|---|---|---|---|---|---|
| TC-AC-001 | 自然语言录入即时回执 | 飞书机器人已配置回调 | 销售向机器人发送一段沟通描述文本 | 3 秒内收到「已记录 ✅」回执，原文入库 status=PENDING | AC-001 |
| TC-AC-002 | AI 不可用时原文不丢 | 模拟大模型网关超时 | 提交录入后令 AI 调用失败 | 数据库仍存完整原文，状态为「待处理/识别失败」 | AC-002 |
| TC-AC-003 | 六要素正确抽取 | AI 网关正常 | 发送「今天上午见了蓝海科技张总，主要聊年度续约，客户关注价格折扣和售后响应时长，目前意向偏积极但还在比价，问题是报价偏高，下一步下周二前出修订报价单再约复盘」 | customer_name=蓝海科技、topic=年度续约沟通、customer_focus=价格折扣与售后响应、intention=偏积极但在比价、issues=报价偏高、next_plan=下周二前出修订报价单 | AC-003 |
| TC-AC-004 | 要素缺失标记待补充 | AI 网关正常 | 发送缺少「下一步计划」的录入文本 | next_plan 字段为空，看板对应字段显示「待补充」，记录正常保存展示 | AC-004 |
| TC-AC-005 | 失败重试成功 | AI 首次失败后恢复 | 触发一次识别失败后自动/手动重试 | 重试最终生成结构化结果，状态置 PROCESSED | AC-005 |
| TC-AC-008 | 当日汇总指标统计 | 当日已有若干记录 | 新增 1 条记录，且 1 名销售首次提交 | 当日沟通总次数 +1；已提交销售人数 +1（去重） | AC-008 |
| TC-AC-009 | 记录列表倒序展示 | 当日有多条记录 | 打开看板列表 | 默认当日记录、按提交时间倒序，含提交人/客户名称/沟通主题/提交时间/状态 | AC-009 |
| TC-AC-010 | 详情原文结构化对照 | 存在已处理记录 | 点击任一记录进入详情 | 同屏展示原文与六要素对照，元信息齐全 | AC-010 |
| TC-AC-011 | 看板访问控制 | 未登录 / 非管理白名单用户 | 直接访问看板接口与页面 | 未登录重定向登录页（401）；非管理返回拒绝（403） | AC-011 |
| TC-AC-015 | 全链路 HTTPS 与审计 | 部署完成 | 抓包检查传输、查看访问日志 | 全链路 HTTPS；敏感访问有审计日志 | AC-015 |

---

## 3. 测试结论

| 统计项 | 数值 |
|---|---|
| 用例总数 | 10 |
| 通过 | 10 |
| 失败 | 0 |
| 阻塞 | 0 |
| 通过率 | 100% |

> 全部 P0 用例执行通过；AI 抽取准确率采用人工抽查（AC-003）符合预期。失败重试（AC-005）与安全审计（AC-015）为非功能性验证，已通过。

---

*本测试用例由 测试用例设计 Agent 依据《PRD》V1.0 验收标准编制，由 测试执行 Agent 逐条执行。*
`;

/* ========== 部署阶段 · 部署前准备清单（部署 agent 产出） ========== */
export const DEPLOY_CHECKLIST_DOC = `# 销售沟通记录与管理工具 — 部署前准备清单

## 1. 文档信息

| 项目 | 内容 |
|---|---|
| 文档名称 | 销售沟通记录与管理工具 部署前准备清单 |
| 文档版本 | V1.0 |
| 编写日期 | 2026-09-21 |
| 编写角色 | 部署 Agent |
| 依据 | 《架构设计文档》V1.0 第 10 章部署架构、第 13 章遗留事项 |

> 上线前请逐项核对并打勾。部署形态：Docker Compose 单环境（app / postgres / redis 三容器）+ Nginx 反向代理（HTTPS 终结）。

---

## 2. 外部依赖开通（前置阻塞项）

- [ ] **飞书自建应用**：申请自建应用，开通「机器人」与「网页应用」两种能力（对应架构第 13 章前置条件）；
- [ ] **事件回调配置**：配置消息事件回调地址，需**公网可达域名 + HTTPS**（飞书强制）；
- [ ] **公司统一大模型网关**：申请接入凭证（API Key），确认六要素抽取走公司合规出域路径（AD-01，不直连公网模型）；
- [ ] **飞书 OAuth 网页应用**：配置授权回调地址，用于看板登录（AD-02）。

## 3. 基础设施

- [ ] 准备 **PostgreSQL 14+**（含 JSONB），执行详细设计文档第 3 章 DDL 建表（communication_record / extraction_task / manager_whitelist）；
- [ ] 准备 **Redis**（会话存储 / 限流计数 / 可选任务队列）；
- [ ] 准备单台云主机，安装 Docker / Docker Compose；
- [ ] 配置数据卷持久化 PG 数据。

## 4. 安全与合规

- [ ] **Nginx 配置 TLS**，终结 HTTPS，全链路加密（AC-015）；
- [ ] 敏感配置走**环境变量 / 密钥管理**：飞书 App Secret、大模型网关密钥、DB 密码——**不入库、不入仓**；
- [ ] 初始化 **manager_whitelist**：录入管理人员飞书 user_id（首期 SQL 维护）；
- [ ] 确认会话 Cookie 设置 HttpOnly + Secure + SameSite，Redis 会话过期 8 小时；
- [ ] 开启审计日志（登录 / 看板查询 / 详情查看 / 重新识别，记录操作人/时间/IP）。

## 5. 应用配置

- [ ] 配置时区参数（默认 Asia/Shanghai，用于「当日」统计口径，AD-09）；
- [ ] 配置看板轮询周期（默认 15s，上限 30s，REQ-NF-002）；
- [ ] 配置 AI 抽取超时（30s）与重试策略（指数退避 1/5/15min，最多 3 次）；
- [ ] 配置结构化日志（JSON）与 Micrometer/Prometheus 指标端点、失败告警钩子（AC-017）。

## 6. 数据备份与可用性

- [ ] 配置 **pg_dump 每日逻辑备份**；
- [ ] 配置容器健康检查与自动重启（可用性目标：工作时间 ≥ 99%，AC-014）；
- [ ] 验证任务表持久化：重启后不丢失待处理任务。

## 7. 上线验证（Smoke）

- [ ] 销售通过飞书机器人发送测试录入，3 秒内收到回执（AC-001）；
- [ ] 管理登录 Web 看板，确认当日汇总指标与记录列表正常展示（AC-008/009）；
- [ ] 点开记录详情，确认原文与六要素对照展示正常（AC-010）；
- [ ] 未登录访问看板被重定向至登录页（AC-011）。

---

*本清单由 部署 Agent 依据《架构设计文档》V1.0 编制，上线前请逐项确认。*
`;

/* ========== 虚拟 IDE：编码代码片段（ExtractionService 六要素抽取，Java 17 + Spring Boot 3） ========== */
/** 逐行打字机展示的代码行（与详细设计 §2.3 / §4 AI 抽取契约一致）。 */
export const IDE_CODE_LINES: string[] = [
  '@Service',
  'public class ExtractionService {',
  '',
  '    private final RestClient llmGateway;',
  '    private final ObjectMapper json;',
  '',
  '    /** ARCH-I-03：调用公司统一大模型网关做六要素抽取（AD-01 合规出域）。 */',
  '    public ExtractionResult extractSixElements(String rawText) {',
  '        var prompt = ExtractionPrompt.sixElements(rawText);',
  '        var response = llmGateway.post()',
  '            .uri("/chat/completions")',
  '            .body(Map.of(',
  '                "response_format", Map.of("type", "json_object"),',
  '                "messages", prompt,',
  '                "timeout_seconds", 30))',
  '            .retrieve()',
  '            .body(JsonNode.class);',
  '',
  '        // 解析失败 / 字段非法 → 视为识别失败，进入 TaskWorker 重试（PRD-F-003）',
  '        var node = response.path("choices").path(0).path("message").path("content");',
  '        return parseSixElements(json.readTree(node.asText()));',
  '    }',
  '}',
]

/** 单文件 diff（安全审核发现「超时未配置/验签缺失」后编码 agent 修复的一处改动）。 */
export interface DiffLine { type: 'ctx' | 'add' | 'del'; text: string }
export const IDE_DIFF_LINES: DiffLine[] = [
  { type: 'ctx', text: '@@ ExtractionService.java @@' },
  { type: 'ctx', text: '  private final RestClient llmGateway;' },
  { type: 'del', text: '-        // 默认 RestClient 未设置超时与验签' },
  { type: 'del', text: '-        var response = llmGateway.post()' },
  { type: 'add', text: '+        // 安全修复：显式声明 30s 超时，避免网关长阻塞拖垮 Worker' },
  { type: 'add', text: '+        var response = llmGateway.post()' },
  { type: 'add', text: '+            .timeout(Duration.ofSeconds(30))' },
  { type: 'add', text: '+            .header("X-Gateway-Key", gatewayKey)  // 网关接入凭证（环境变量注入）' },
  { type: 'ctx', text: '              .uri("/chat/completions")' },
]

/* ========== 测试执行窗口：用例（与测试用例文档一一对应） ========== */
export interface MockTestCase { id: string; title: string }
export const MOCK_TEST_CASES: MockTestCase[] = [
  { id: 'TC-AC-001', title: '自然语言录入即时回执' },
  { id: 'TC-AC-002', title: 'AI 不可用时原文不丢' },
  { id: 'TC-AC-003', title: '六要素正确抽取' },
  { id: 'TC-AC-004', title: '要素缺失标记待补充' },
  { id: 'TC-AC-005', title: '失败重试成功' },
  { id: 'TC-AC-008', title: '当日汇总指标统计' },
  { id: 'TC-AC-009', title: '记录列表倒序展示' },
  { id: 'TC-AC-010', title: '详情原文结构化对照' },
  { id: 'TC-AC-011', title: '看板访问控制' },
  { id: 'TC-AC-015', title: '全链路 HTTPS 与审计' },
]

/* ========== 安全审核发现的问题（安全阶段 mock） ========== */
export const SECURITY_FINDING = '发现安全缺陷：ExtractionService 调用大模型网关未显式设置超时，且网关接入凭证未通过请求头注入；飞书回调验签逻辑需复核。已退回编码阶段修复。'
