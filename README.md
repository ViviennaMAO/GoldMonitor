# GoldMonitor · 黄金因子量化看板

> 一个人 + Claude Opus 4.6 搭建的、面向普通投资者的**可解释黄金量化看板**。
>
> Web 端部署在 Vercel，移动端发布在 Luffa Super Box 小程序。

![stack](https://img.shields.io/badge/Next.js-14-black) ![python](https://img.shields.io/badge/Python-3.10-blue) ![model](https://img.shields.io/badge/XGBoost-multi--scale-green) ![license](https://img.shields.io/badge/license-MIT-lightgrey)

---

## ✨ 项目简介

市面上的黄金分析工具大多只给"走势图 + 结论"，缺乏系统性的因子分解和可解释信号。GoldMonitor 想做一件事：

> **让每一笔买卖信号，都能说清楚"为什么"。**

- 📊 **8 因子 XGBoost 多尺度集成模型**（10d / 20d / 40d 加权融合）
- 🧠 **SHAP 归因** —— 每一次预测都能拆解到具体因子贡献
- 🌡️ **三层 Regime 检测** —— 宏观象限 / HMM 状态 / 事件冲击
- 🛡️ **风控闭环** —— Kelly 仓位 + ATR 止损 + 回撤熔断
- 📱 **双前端** —— Next.js Web + Luffa Super Box 小程序

---

## 🏗️ 技术栈

| 层级 | 技术 |
|------|------|
| **数据** | FRED、Stooq、Yahoo Finance |
| **因子工程** | Python + pandas + numpy |
| **模型** | XGBoost（多尺度集成）+ SHAP + HMM |
| **风控** | Kelly Criterion + ATR Stops + Purged CV |
| **后端 API** | Next.js 14 App Router (API Routes) |
| **Web 前端** | Next.js 14 + React 18 + TypeScript + Tailwind + Recharts + SWR |
| **移动端** | Luffa Super Box 小程序（WXML/WXSS/JS） |
| **部署** | Vercel (Web) + Luffa (小程序) |
| **开发工具** | Claude Code (Opus 4.6) |

---

## 📂 项目结构

```
GoldMonitor/
├── gold-dashboard/              # Web 端 + ML Pipeline
│   ├── src/
│   │   ├── app/                 # Next.js App Router + API 路由
│   │   ├── components/          # React 组件（TopBar、FactorCard、SHAP 等）
│   │   ├── lib/                 # 数据获取 hooks
│   │   └── types/               # TypeScript 类型定义
│   ├── pipeline/                # Python ML Pipeline
│   │   ├── fetch_data.py        # 数据抓取
│   │   ├── features.py          # 因子构建
│   │   ├── train.py             # 模型训练
│   │   ├── multiscale.py        # 多尺度集成
│   │   ├── inference.py         # 线上推理
│   │   ├── backtest.py          # 回测引擎
│   │   ├── regime_v2.py         # 三层 Regime 检测
│   │   ├── cpcv.py              # Combinatorially Purged CV
│   │   ├── kelly.py             # Kelly 仓位计算
│   │   └── ic_diagnostic.py     # IC 诊断
│   └── package.json
├── miniprogram/                 # Luffa Super Box 小程序
│   ├── pages/                   # 看板/因子/回测/账户
│   └── utils/                   # API 客户端
├── docs/                        # 技术文档、研报
└── 研发日志/                    # 开发日志
```

---

## 🎯 核心因子（8 个，从 15 个精简而来）

| 编号 | 名称 | 逻辑 |
|------|------|------|
| F1   | DXY 美元指数 | 美元走强 → 金价承压（反向） |
| F4   | BEI 通胀预期 | 通胀上行 → 黄金受益 |
| F5   | GPR 地缘风险 | 风险事件 → 避险买盘 |
| F6   | GVZ 波动率 | 波动率飙升 → 市场恐慌 |
| F10  | TIPS-BEI Spread | 实际收益率与通胀的差值（**IC +0.73，最高**） |
| F11  | DXY Momentum | 美元 20 日加速度 |
| F13  | Gold-GDX Divergence | 金价与矿业股能量差（消融测试最有价值） |
| F14  | GVZ Momentum | 波动率政体转换信号 |

**精简原则**：
- IC ≈ 0 的因子直接砍掉（ETFFlow、DXYDownGPRUp）
- 相关系数 r > 0.7 的只留一个（TIPS 被 F10 代替）
- Granger 因果不显著 → 移除

---

## 🚀 快速开始

### Web 端

```bash
cd gold-dashboard
npm install
npm run dev                     # 默认跑在 :3031
```

打开 http://localhost:3031 即可看到看板。

### Pipeline（训练 + 推理）

```bash
cd gold-dashboard/pipeline
pip install -r requirements.txt

python fetch_data.py            # 抓数据
python train.py                 # 训练多尺度模型
python run_daily.py             # 每日推理 + 写出 JSON 给前端
```

### Luffa 小程序

1. 用 Luffa Super Box 开发者工具打开 `miniprogram/` 目录
2. 在 `utils/` 里配置 API 地址（指向 Vercel 部署的后端）
3. 一键上架，无需公司主体 KYC

---

## 📸 界面预览

看板遵循**"信号居中、因子左右、风控在后"**的设计原则：

- **Signal Banner** —— 最醒目的位置展示 Buy / Sell / Neutral + 预测收益率 + 置信度
- **因子卡片** —— Z-score、52 周百分位、SHAP 贡献，悬停查看详情
- **SHAP 瀑布图** —— 每次预测的因子拆解一目了然
- **Regime 热力图** —— 三层结构（宏观象限 + HMM 状态 + 事件冲击）
- **账户面板** —— 权益曲线、Sharpe、最大回撤、胜率

图片见 `goldmonitor_pics/` 目录。

---

## 🧪 模型表现

- **训练窗口**：2015-01-01 ~ 2025-09-30
- **验证方法**：Purged CV + 20 天 gap（避免泄漏）
- **目标**：20 日前瞻收益率
- **集成**：10d / 20d / 40d 三个 XGBoost，用滚动 60 日 IC 动态加权
- **信号阈值**：Strong Buy ≥ 1.2% / Buy ≥ 0.5% / Sell ≤ −0.5% / Strong Sell ≤ −1.2%

---

## 🧰 为什么选 Claude Opus 4.6

| 维度 | Opus 4.6 的优势 |
|------|----------------|
| 复杂代码 | 一次写完整 pipeline（含 purged CV、SHAP、regime） |
| 架构理解 | 理解因子间关系，主动建议剪枝 |
| 跨栈能力 | Python pipeline + Next.js + 小程序 WXML 无缝切换 |
| 圆桌讨论 | 能模拟 Dalio / Taleb / Simons 多视角压力测试 idea |

---

## 🌐 为什么用 Luffa Super Box 作为移动端

相比传统小程序，Luffa 解决了独立开发者的几个关键痛点：

| 维度 | Luffa Super Box | 传统方案 |
|------|-----------------|---------|
| 注册门槛 | **钱包注册，无 KYC** | 腾讯小程序需要公司主体 + 严格审核 |
| 出入金 | **Crypto 支付，低手续费** | App Store 抽 30% |
| 社区通讯 | **端到端加密群聊** | Telegram 功能强但无原生小程序 |
| 内容传播 | **频道功能**，支持图文/视频 | X / 微信公众号平台规则受限 |

对于金融/量化类 AI 产品来说，Luffa 是目前摩擦力最低的分发平台。

---

## 📚 相关文档

- [黄金因子交易看板 · PRD](./黄金因子交易看板_产品需求文档（PRD）.md)
- [产品架构与运行全景图](./GoldMonitor_产品架构与运行全景图.docx)
- [圆桌研讨会：Sharpe Ratio 优化深度对话](./圆桌研讨会Sharpe%20Ratio%20优化深度对话.docx)
- [AI Builder 搭建手册](./docs/ai_builder_guide.docx)

---

## ⚠️ 免责声明

本项目仅用于技术研究和教育目的，**不构成任何投资建议**。黄金市场存在风险，使用本系统的任何信号进行实盘交易均由使用者自行承担。

---

## 📮 联系

- Author: **Vivienna**
- Built with: **Claude Opus 4.6** + Next.js + Luffa Super Box
- License: MIT
