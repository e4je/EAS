# ESA 访问及回源日志分析平台 Agent Spec

## 背景

用户已在阿里云 ESA 创建「访问及回源日志」实时投递任务，日志已经投递到兼容 S3 的对象存储（用户称 CF S2，按 Cloudflare R2 / S3 Compatible Storage 兼容处理）。需要实现一个全栈日志分析平台，用于从对象存储读取 ESA 实时日志，完成解析、清洗、存储、查询、可视化、告警和智能分析。

官方依据：

- 阿里云 ESA 实时日志支持秒级交付，并支持投递到 SLS、OSS、AWS S3、兼容 S3 的其他存储、HTTP 服务器或 Kafka。
- 「访问及回源日志」为站点维度日志，记录用户访问 ESA 加速站点以及 ESA 节点回源访问源站时产生的详细请求信息。
- 该日志字段主要覆盖 General、Client、ClientRequest、Edge、Origin、OriginResponse、Security 等维度。

## 总体目标

构建一个高级、专业、实时感强的 Web 日志分析平台，面向站点运维、安全运营、性能优化和业务分析。

平台必须做到：

- 自动从兼容 S3 存储拉取 ESA 访问及回源日志。
- 支持日志文件增量同步、去重、失败重试和延迟补偿。
- 将原始日志解析为结构化事件。
- 支持高性能查询、聚合、筛选和下钻。
- 提供高级可视化大盘，覆盖流量、性能、缓存、回源、安全、Bot、地理分布、异常检测。
- 支持明细日志检索，能够像日志平台一样快速定位单个请求。
- 支持告警规则和异常发现。
- UI 必须显得高级、现代、专业，适合生产环境使用。

## 推荐技术栈

可以根据实际部署环境调整，但建议优先选择以下组合：

- Frontend: Next.js + TypeScript + Tailwind CSS + shadcn/ui 或同等高级组件体系。
- Charts: Apache ECharts 或 Recharts，地图建议使用 ECharts Map / Mapbox / Leaflet。
- Backend: Next.js API Routes、NestJS、Fastify 或 Hono。
- Ingestion Worker: Node.js worker / Python worker / Go worker 均可，必须和 Web 服务解耦。
- Object Storage SDK: AWS S3 SDK，使用 S3-compatible endpoint、access key、secret key、bucket、prefix。
- OLAP Storage: ClickHouse 优先。小规模可用 PostgreSQL + TimescaleDB，单机轻量版可用 DuckDB。
- Queue: BullMQ + Redis、RabbitMQ、Kafka 或云队列，用于异步解析文件。
- Auth: NextAuth/Auth.js 或自建 JWT，会话、角色权限必须具备。
- Deployment: Docker Compose 起步，生产可扩展到 Kubernetes。

## 核心数据源

日志类型：ESA 访问及回源日志。

关键字段需要优先支持：

### General

- `BotTag`: Bot 类型，可能包括 malicious、normal、suspected、unrecognized。
- `ClientRequestID`: 客户端请求唯一标识，用于单请求追踪。
- `EdgeServerID`: ESA 节点服务器唯一标识。
- `EdgeServerIP`: ESA 节点 IP。
- `EdgeStartTimestamp`: ESA 节点收到客户端请求时间。
- `EdgeEndTimestamp`: ESA 节点完成响应时间。
- `SiteName`: 站点名称。
- `JA3Hash`, `JA4Hash`, `TlsHash`: TLS / 客户端指纹。
- `SmartRoutingStatus`: 智能路由状态。

### Client

- `ClientIP`: 与 ESA 节点建连的客户端 IP。
- `ClientASN`: ASN。
- `ClientCountryCode`: 国家代码。
- `ClientRegionCode`: 区域代码。
- `ClientISP`: 运营商。
- `ClientSSLProtocol`: 客户端 SSL 协议。
- `ClientSSLCipher`: SSL 加密套件。
- `ClientSrcPort`: 客户端端口。

### ClientRequest

- `ClientRequestHost`: Host。
- `ClientRequestMethod`: HTTP Method。
- `ClientRequestPath`: 请求路径。
- `ClientRequestURI`: URI。
- `ClientRequestQuery`: Query。
- `ClientRequestScheme`: Scheme。
- `ClientRequestProtocol`: 协议。
- `ClientRequestReferer`: Referer。
- `ClientRequestUserAgent`: User-Agent。
- `ClientRequestBytes`: 请求大小。
- `ClientRequestHeaderRange`: Range 请求头。

### Edge

- `EdgeCacheStatus`: 缓存状态。
- `EdgeRequestHost`: ESA 节点回源 Host。
- `EdgeResponseStatusCode`: ESA 返回给客户端的状态码。
- `EdgeResponseBytes`: ESA 返回响应总大小。
- `EdgeResponseBodyBytes`: ESA 返回 Body 大小。
- `EdgeResponseContentType`: 响应 Content-Type。
- `EdgeResponseCompressionAlgo`: 压缩算法。
- `EdgeResponseCompressionRatio`: 压缩比。
- `EdgeResponseTime`: ESA 从收到请求到返回最后一个字节的整体耗时，单位 ms。
- `EdgeTimeToFirstByteMs`: 边缘首字节耗时，单位 ms。

### Origin

- `OriginIP`: 回源 IP，`-` 表示未回源。
- `OriginDNSResponseTimeMs`: 源站 DNS 解析耗时，`-1` 表示未回源。
- `OriginTCPHandshakeDurationMs`: 源站 TCP 握手耗时，`-1` 表示未回源。
- `OriginTLSHandshakeDurationMs`: 源站 TLS 握手耗时，`-1` 表示未回源或 HTTP 回源。
- `OriginSSLProtocol`: 回源 SSL 协议。
- `OriginResponseDurationMs`: 源站首字节耗时，`-1` 表示未回源。
- `OriginResponseStatusCode`: 源站状态码，`-1` 表示未回源。
- `OriginResponseHTTPExpires`, `OriginResponseHTTPLastModified`, `OriginResponseHeaderRange`。

### Security

- `SecAction`: 本次请求最终执行的防护动作。
- `SecActions`: 本次请求执行的全部防护动作。
- `SecRuleID`, `SecRuleIDs`: 防护规则 ID，`-1` 可表示 DDoS 基础防护。
- `SecSource`, `SecSources`: 命中的防护规则来源。

## 数据接入要求

### 存储连接配置

后台需要提供「数据源配置」页面：

- Endpoint。
- Bucket。
- Region，可选。
- Access Key ID。
- Secret Access Key，必须加密保存。
- Prefix / 目录前缀。
- 文件格式配置：JSON Lines、JSON Array、CSV、TSV、Gzip 压缩等，需可配置。
- 时区配置，默认 Asia/Shanghai。
- 测试连接按钮。
- 最近同步状态展示。

### 增量同步

必须支持：

- 基于对象 key、lastModified、etag/size 的增量扫描。
- 同步游标表，记录已处理文件、处理状态、记录数、错误信息。
- 失败文件可重试。
- 支持手动重新导入某个时间范围。
- 支持日志迟到，建议扫描最近 N 小时窗口并按 request id / hash 去重。

### 解析与清洗

必须支持：

- 自动识别 gzip。
- 逐行流式解析，避免大文件一次性读入内存。
- 字段类型转换：时间、整数、浮点、字符串。
- 将 `-`、空字符串、`-1` 等特殊值按语义处理。
- IP 归属地、ASN、UA 解析可作为增强任务。
- Query 参数默认脱敏展示，避免泄露 token、key、password、signature 等敏感信息。
- 原始日志保留，可按需查看。

## 数据模型

建议核心表：

### `log_events`

字段至少包括：

- `id`: 内部唯一 ID。
- `source_file`: 来源对象 key。
- `source_etag`: 来源对象 etag。
- `ingested_at`: 入库时间。
- `event_time`: 事件时间，优先使用 `EdgeStartTimestamp`。
- `site_name`
- `client_request_id`
- `client_ip`
- `client_country_code`
- `client_region_code`
- `client_asn`
- `client_isp`
- `client_ssl_protocol`
- `bot_tag`
- `request_host`
- `request_method`
- `request_path`
- `request_uri`
- `request_query`
- `request_scheme`
- `request_protocol`
- `request_referer`
- `request_user_agent`
- `request_bytes`
- `edge_server_id`
- `edge_server_ip`
- `edge_cache_status`
- `edge_status_code`
- `edge_response_bytes`
- `edge_body_bytes`
- `edge_content_type`
- `edge_response_time_ms`
- `edge_ttfb_ms`
- `origin_ip`
- `origin_status_code`
- `origin_dns_ms`
- `origin_tcp_ms`
- `origin_tls_ms`
- `origin_response_ms`
- `sec_action`
- `sec_rule_id`
- `sec_source`
- `ja3_hash`
- `ja4_hash`
- `tls_hash`
- `raw`

### `ingestion_files`

- `object_key`
- `etag`
- `size`
- `last_modified`
- `status`: pending / processing / success / failed / skipped。
- `record_count`
- `error_count`
- `error_message`
- `started_at`
- `finished_at`

### `saved_views`

- 保存筛选条件、图表配置、时间范围和用户自定义视图。

### `alert_rules`

- 告警规则配置。

### `alert_events`

- 告警触发历史。

## 查询与筛选能力

全局筛选器必须支持：

- 时间范围：最近 5 分钟、15 分钟、1 小时、6 小时、24 小时、7 天、自定义。
- 站点。
- Host。
- Path / URI 模糊搜索。
- Method。
- 状态码分组：2xx、3xx、4xx、5xx。
- 缓存状态。
- 是否回源。
- Origin IP。
- Client IP。
- 国家/地区。
- ASN / ISP。
- BotTag。
- SecAction / SecSource / SecRuleID。
- JA3 / JA4 / TLS 指纹。
- User-Agent 关键字。
- Referer 域名。

需要支持：

- 多条件组合。
- 排除条件。
- Top N 聚合。
- Drilldown：从图表点击进入对应筛选明细。
- 导出 CSV / JSON。
- 保存查询。

## 页面与功能设计

### 1. 总览驾驶舱

第一屏必须具备高级感，不做营销页，直接进入可操作大盘。

核心指标：

- 总请求数。
- 峰值 QPS / 平均 QPS。
- 总流量。
- 4xx 率。
- 5xx 率。
- 缓存命中率。
- 回源率。
- P50 / P90 / P95 / P99 响应耗时。
- P95 / P99 Edge TTFB。
- 安全动作次数。
- 可疑 / 恶意 Bot 占比。

核心图表：

- 请求量时间序列。
- 带宽/流量时间序列。
- 状态码堆叠面积图。
- 缓存命中状态分布。
- Edge 响应耗时分位数趋势。
- 回源耗时趋势：DNS、TCP、TLS、Origin TTFB。
- 地理访问热力图。
- Top Host / Path / IP / Referer / User-Agent。

### 2. 实时监控

提供近实时视图：

- 自动刷新，刷新间隔可配置。
- 最新请求流。
- QPS、错误率、回源率、缓存命中率实时小图。
- 异常突增提示。
- 可暂停刷新并检查请求详情。

### 3. 日志检索

类日志平台体验：

- 左侧筛选器。
- 中间表格。
- 右侧详情抽屉。
- 支持字段选择、列宽调整、排序。
- 点击一条日志展示完整字段、原始 JSON、请求链路耗时拆解。
- 支持复制 request id、IP、URI。

详情页需要突出：

- 请求基本信息。
- Client 信息。
- Edge 信息。
- Origin 信息。
- Security 信息。
- 耗时瀑布图：Client -> Edge -> DNS -> TCP -> TLS -> Origin -> Response。

### 4. 性能分析

必须覆盖：

- Edge 响应耗时分布。
- Edge TTFB 分位数。
- Origin DNS/TCP/TLS/Response 分解。
- 慢请求 Top Path。
- 慢源站 IP。
- 按国家、ISP、ASN 的性能对比。
- 状态码和耗时的交叉分析。
- Content-Type 维度性能分析。

关键洞察：

- 区分 ESA 边缘慢、源站慢、DNS 慢、TCP 慢、TLS 慢。
- 未回源请求和回源请求分开分析。
- 对缓存未命中且耗时高的路径进行排序。

### 5. 缓存分析

必须覆盖：

- 缓存命中率趋势。
- EdgeCacheStatus 分布。
- Top MISS/BYPASS/EXPIRED Path。
- 命中率最低的 Host / Path。
- 回源率最高的内容类型。
- 缓存命中节省流量估算。
- 大文件 Range 请求分析。

输出建议：

- 哪些路径应该优化缓存策略。
- 哪些资源频繁回源。
- 哪些 Query 参数导致缓存碎片。

### 6. 回源分析

必须覆盖：

- 回源请求量和回源率。
- Origin IP 分布。
- 源站状态码分布。
- 源站 5xx 趋势。
- Origin DNS/TCP/TLS/Response 耗时趋势。
- 源站慢请求 Top。
- 回源 Host 与 Client Host 差异分析。

重点识别：

- 源站错误。
- 源站超慢。
- 源站 TLS 握手异常。
- 源站 DNS 解析耗时异常。
- 某个 Origin IP 质量明显低于其他 IP。

### 7. 安全分析

即使目前只有访问及回源日志，也要利用内含的 Security 字段做安全视图。

必须覆盖：

- SecAction 趋势。
- SecSource 分布。
- SecRuleID Top。
- 恶意/可疑 Bot 趋势。
- JA3/JA4/TLS 指纹聚类。
- 高频 IP。
- 高频 ASN。
- 异常 User-Agent。
- 异常 Referer。
- 高频 403/429/444/499/5xx 来源。
- Path 扫描行为识别。

风险模型建议：

- 单 IP 高频请求。
- 单 IP 多路径扫描。
- 单 JA3/JA4 多 IP 分布。
- 单 ASN 异常增长。
- 非正常 BotTag 占比上升。
- 突发 4xx / WAF action。
- 可疑 UA：curl、python、go-http-client、无 UA、扫描器特征。

### 8. Bot 与爬虫分析

必须覆盖：

- BotTag 分布。
- 恶意、可疑、正常、未识别趋势。
- Bot 来源国家、ASN、IP、UA。
- Bot 访问路径 Top。
- Bot 与状态码关系。
- 正常搜索引擎爬虫和异常爬虫区分。

### 9. 地理与网络分析

必须覆盖：

- 国家/地区访问分布。
- 地图热力。
- ASN / ISP Top。
- 国家维度错误率、缓存命中率、P95 延迟。
- 海外访问与国内访问对比。

### 10. 业务分析

必须覆盖：

- PV / 请求趋势。
- Top 页面 / API。
- Top Referer。
- Top Content-Type。
- Method 分布。
- 请求大小、响应大小分布。
- 大流量路径。
- 异常增长路径。

### 11. 告警中心

支持规则：

- 请求量突增。
- 5xx 率超过阈值。
- 4xx 率超过阈值。
- 缓存命中率低于阈值。
- 回源率超过阈值。
- P95 响应耗时超过阈值。
- Origin 5xx 超过阈值。
- 单 IP 请求数超过阈值。
- 恶意 Bot 占比超过阈值。
- SecAction deny/captcha/js 等动作突增。
- 某个 Host/Path 异常。

告警动作：

- 站内通知。
- Webhook。
- 邮件，可选。
- 企业微信/飞书/钉钉，可选。

告警展示：

- 当前活跃告警。
- 历史告警。
- 告警关联日志一键下钻。
- 告警规则启停和静默。

## 智能分析要求

如果接入 LLM，需要实现「分析助手」：

- 能根据当前筛选条件总结异常。
- 能解释 5xx、回源慢、缓存命中率下降的可能原因。
- 能生成优化建议。
- 能把自然语言转换成筛选条件，例如：“看过去 1 小时 5xx 最高的路径”。
- 必须基于聚合结果和样本日志回答，避免凭空猜测。
- 回答中要附带可点击的查询条件或跳转。

内置分析模板：

- 5xx 根因分析。
- 缓存命中率下降分析。
- 回源慢分析。
- 疑似攻击分析。
- Bot 异常分析。
- 热门路径增长分析。

## UI 设计要求

整体感觉：高级、深色优先、现代、数据密度高但不拥挤，类似专业安全运营中心 / 云观测平台。

设计原则：

- 默认深色主题，同时支持浅色主题。
- 顶部为全局时间范围、站点、刷新状态。
- 左侧为主导航：总览、实时、检索、性能、缓存、回源、安全、Bot、地理、告警、设置。
- 大盘卡片不要过度圆角，建议 8px 或更小。
- 使用图标按钮、紧凑表格、状态徽标、趋势色。
- 不要做营销式 Hero，不要做大面积空白介绍页。
- 图表要有悬浮提示、图例、单位、空状态和加载状态。
- 所有图表均可点击下钻。
- 表格支持虚拟滚动，避免大量日志卡顿。
- 关键异常用红/橙，但整体不要变成单一蓝紫或单一黑灰。
- 需要有“生产级质感”：骨架屏、错误状态、空数据状态、权限受限状态都要完整。

推荐页面视觉：

- 深色背景：接近 `#0B1020`，面板 `#111827` / `#151B2E`。
- 强调色不要只用紫色，可组合青色、绿色、琥珀色、红色。
- 指标卡使用微弱边框和微弱阴影。
- 图表采用清晰网格线和高对比色。
- 日志详情抽屉像专业排障工具，字段可复制。

## 权限与安全

必须支持：

- 登录认证。
- 角色权限：Admin、Analyst、Viewer。
- 数据源密钥加密存储。
- 操作审计。
- 敏感字段脱敏：Query token、Authorization、Cookie、password、secret、key、signature。
- IP 可选择脱敏展示。
- 导出权限控制。
- 多站点隔离。

## 性能要求

目标：

- 常规大盘查询 < 2 秒。
- 明细检索 < 3 秒。
- Top N 聚合 < 3 秒。
- 单表支持至少千万级日志起步。
- 支持分区：按日期、站点。
- 支持 TTL：热数据、冷数据、原始文件可分层。
- 支持物化视图或预聚合：分钟级请求量、状态码、缓存、回源、Bot、安全动作。

ClickHouse 建议：

- 主表使用 MergeTree。
- Partition by `toDate(event_time)`。
- Order by `(site_name, event_time, request_host, edge_status_code)`。
- 常用字段使用 LowCardinality。
- 对 `client_ip`、`request_path`、`client_request_id` 保留查询优化策略。

## API 要求

至少实现：

- `POST /api/datasources/test`
- `GET /api/datasources`
- `POST /api/datasources`
- `POST /api/ingestion/run`
- `GET /api/ingestion/files`
- `GET /api/metrics/overview`
- `GET /api/metrics/timeseries`
- `GET /api/metrics/top`
- `GET /api/logs/search`
- `GET /api/logs/:id`
- `GET /api/analytics/performance`
- `GET /api/analytics/cache`
- `GET /api/analytics/origin`
- `GET /api/analytics/security`
- `GET /api/analytics/bots`
- `GET /api/analytics/geo`
- `GET /api/alerts/rules`
- `POST /api/alerts/rules`
- `GET /api/alerts/events`
- `POST /api/assistant/analyze`

## 首版 MVP 范围

第一版必须交付：

- S3-compatible 数据源配置和连接测试。
- 增量导入 worker。
- 访问及回源日志解析。
- ClickHouse 或 PostgreSQL 存储。
- 总览驾驶舱。
- 日志检索和详情抽屉。
- 性能分析。
- 缓存分析。
- 回源分析。
- 安全/Bot 基础分析。
- 告警规则基础版。
- 深色高级 UI。
- Docker Compose 一键启动。

## 验收标准

功能验收：

- 能连接兼容 S3 存储并读取指定 prefix 下的日志文件。
- 能增量导入，不重复导入同一文件。
- 能展示最近 24 小时请求量、状态码、缓存命中率、回源率、P95 响应耗时。
- 能搜索某个 Client IP、Path、Host、状态码、Request ID。
- 能打开单条日志详情并显示 Client、Edge、Origin、Security 信息。
- 能看到 Top Path、Top IP、Top Referer、Top User-Agent。
- 能分析缓存 MISS/BYPASS/EXPIRED 的路径。
- 能分析源站 5xx 和慢回源。
- 能展示 BotTag 和 SecAction 趋势。
- 能创建并触发至少一种告警规则。

体验验收：

- 首屏是专业数据大盘，不是介绍页。
- 图表、表格、筛选器、详情抽屉都可用。
- 移动端至少能正常查看核心指标和日志详情。
- 加载、空数据、错误状态完整。
- 页面视觉高级，不廉价，不杂乱。

工程验收：

- README 包含启动步骤、环境变量、数据源配置说明。
- `.env.example` 包含所有必要配置。
- Docker Compose 可启动数据库、后端、前端、worker。
- 有基础测试：解析器测试、API 测试、关键聚合测试。
- 日志解析异常不会导致 worker 崩溃。

## 重要实现提醒

- 不要假设 ESA 投递文件格式固定，提供格式配置和样例日志导入。
- 不要把 Query 原样到处展示，必须脱敏。
- 不要只做简单 Top 表，要有性能、缓存、回源、安全的交叉分析。
- 不要把 UI 做成普通后台模板，要做成高密度、高质感的观测平台。
- 所有图表都要能下钻到日志明细。
- 所有时间序列都要清楚显示时间范围、粒度和单位。
- 所有指标口径要在代码中集中定义，避免不同页面口径不一致。

