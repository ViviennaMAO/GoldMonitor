const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, LevelFormat, TabStopType, TabStopPosition,
  PageOrientation,
} = require("docx");

// ── Colors ──
const C = {
  gold: "B8860B", navy: "1B2A4A", accent: "2E75B6", white: "FFFFFF",
  lightGray: "F5F5F5", medGray: "E0E0E0", darkGray: "666666",
  textDark: "1A1A1A", textMed: "4A4A4A", textLight: "888888",
  // Layer colors
  extBlue: "1565C0", extBlueBg: "E3F2FD",
  pipeGreen: "2E7D32", pipeBg: "E8F5E9",
  apiBrown: "E65100", apiBg: "FFF3E0",
  feBlue: "6A1B9A", feBg: "F3E5F5",
  miniTeal: "00695C", miniBg: "E0F2F1",
  red: "C62828", redBg: "FFEBEE",
  green: "2E7D32", greenBg: "E8F5E9",
  orange: "EF6C00", orangeBg: "FFF3E0",
  blue: "1565C0", blueBg: "E3F2FD",
  purple: "6A1B9A", purpleBg: "F3E5F5",
  teal: "00695C", tealBg: "E0F2F1",
};

// ── Helpers ──
const border = { style: BorderStyle.SINGLE, size: 1, color: C.medGray };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0 };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const thickBorder = (color) => ({ style: BorderStyle.SINGLE, size: 3, color });

function t(text, opts = {}) {
  return new TextRun({ text, font: opts.font || "PingFang SC", size: opts.size || 20, color: opts.color || C.textDark, bold: opts.bold, italics: opts.italics, ...opts });
}
function mono(text, opts = {}) {
  return new TextRun({ text, font: "Menlo", size: opts.size || 18, color: opts.color || C.textMed, ...opts });
}

function heading1(title) {
  return new Paragraph({
    spacing: { before: 360, after: 180 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.gold, space: 8 } },
    children: [t(title, { size: 32, bold: true, color: C.navy })],
  });
}
function heading2(title) {
  return new Paragraph({
    spacing: { before: 280, after: 140 },
    children: [t("| ", { size: 26, bold: true, color: C.gold }), t(title, { size: 26, bold: true, color: C.navy })],
  });
}
function heading3(title) {
  return new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [t(title, { size: 22, bold: true, color: C.accent })],
  });
}
function para(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60, line: 340 },
    indent: opts.indent ? { firstLine: 440 } : undefined,
    alignment: opts.align,
    children: [t(text, { size: 20, color: opts.color || C.textDark })],
  });
}
function spacer(h = 160) { return new Paragraph({ spacing: { before: h, after: 0 }, children: [] }); }

// ── Architecture Box Component ──
function archBox(label, sublabel, items, accentColor, bgColor, width = 9360) {
  const headerBorder = {
    top: thickBorder(accentColor), bottom: thickBorder(accentColor),
    left: thickBorder(accentColor), right: thickBorder(accentColor),
  };
  const bodyBorder = {
    top: { style: BorderStyle.NONE, size: 0 },
    bottom: thickBorder(accentColor), left: thickBorder(accentColor), right: thickBorder(accentColor),
  };

  const headerRow = new TableRow({
    children: [new TableCell({
      borders: headerBorder,
      width: { size: width, type: WidthType.DXA },
      shading: { fill: accentColor, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 160, right: 160 },
      children: [new Paragraph({
        children: [
          t(label, { size: 22, bold: true, color: C.white }),
          t(sublabel ? `  ${sublabel}` : "", { size: 18, color: "CCCCCC" }),
        ],
      })],
    })],
  });

  const bodyRow = new TableRow({
    children: [new TableCell({
      borders: bodyBorder,
      width: { size: width, type: WidthType.DXA },
      shading: { fill: bgColor, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 160, right: 160 },
      children: items.map(item => {
        if (typeof item === "string") {
          return new Paragraph({ spacing: { before: 30, after: 30 }, children: [t(item, { size: 18, color: C.textMed })] });
        }
        return item;
      }),
    })],
  });

  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: [width],
    rows: [headerRow, bodyRow],
  });
}

// ── Flow Arrow ──
function flowArrow(label, direction = "down") {
  const arrow = direction === "down" ? "\u25BC" : direction === "right" ? "\u25B6" : "\u25B2";
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 80 },
    children: [
      t(`${arrow}  `, { size: 24, color: C.gold, font: "Arial" }),
      t(label, { size: 18, color: C.textLight, italics: true }),
      t(`  ${arrow}`, { size: 24, color: C.gold, font: "Arial" }),
    ],
  });
}

// ── Compact Data Table ──
function dataTable(headers, rows, colWidths, headerColor = C.navy) {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

  const headerRow = new TableRow({
    children: headers.map((h, i) => new TableCell({
      borders, width: { size: colWidths[i], type: WidthType.DXA },
      shading: { fill: headerColor, type: ShadingType.CLEAR },
      margins: cellMargins,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [t(h, { size: 18, bold: true, color: C.white })] })],
    })),
  });

  const dataRows = rows.map((row, ri) => new TableRow({
    children: row.map((cell, ci) => new TableCell({
      borders, width: { size: colWidths[ci], type: WidthType.DXA },
      shading: { fill: ri % 2 === 0 ? C.white : C.lightGray, type: ShadingType.CLEAR },
      margins: cellMargins,
      children: [new Paragraph({
        alignment: ci === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
        children: [t(String(cell), { size: 17, color: C.textDark })],
      })],
    })),
  }));

  return new Table({ width: { size: totalWidth, type: WidthType.DXA }, columnWidths: colWidths, rows: [headerRow, ...dataRows] });
}

// ── Two-column layout ──
function twoCol(left, right, leftWidth = 4580, rightWidth = 4580) {
  return new Table({
    width: { size: leftWidth + rightWidth + 200, type: WidthType.DXA },
    columnWidths: [leftWidth, 200, rightWidth],
    rows: [new TableRow({
      children: [
        new TableCell({ borders: noBorders, width: { size: leftWidth, type: WidthType.DXA }, children: left }),
        new TableCell({ borders: noBorders, width: { size: 200, type: WidthType.DXA }, children: [new Paragraph("")] }),
        new TableCell({ borders: noBorders, width: { size: rightWidth, type: WidthType.DXA }, children: right }),
      ],
    })],
  });
}

// ── Three-column layout ──
function threeCol(a, b, c, w = 3020) {
  const gap = 150;
  return new Table({
    width: { size: w * 3 + gap * 2, type: WidthType.DXA },
    columnWidths: [w, gap, w, gap, w],
    rows: [new TableRow({
      children: [
        new TableCell({ borders: noBorders, width: { size: w, type: WidthType.DXA }, children: a }),
        new TableCell({ borders: noBorders, width: { size: gap, type: WidthType.DXA }, children: [new Paragraph("")] }),
        new TableCell({ borders: noBorders, width: { size: w, type: WidthType.DXA }, children: b }),
        new TableCell({ borders: noBorders, width: { size: gap, type: WidthType.DXA }, children: [new Paragraph("")] }),
        new TableCell({ borders: noBorders, width: { size: w, type: WidthType.DXA }, children: c }),
      ],
    })],
  });
}

// ══════════════════════════ BUILD DOCUMENT ══════════════════════════

const doc = new Document({
  styles: { default: { document: { run: { font: "PingFang SC", size: 20 } } } },
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
    }],
  },
  sections: [
    // ════════════════════ COVER ════════════════════
    {
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      children: [
        spacer(2000),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [t("GOLD MONITOR", { size: 56, bold: true, color: C.gold, font: "Arial" })] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: C.gold, space: 12 } },
          spacing: { after: 500 },
          children: [t("SYSTEM ARCHITECTURE", { size: 28, color: C.textLight, font: "Arial" })],
        }),
        spacer(300),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [t("产品架构与运行全景图", { size: 44, bold: true, color: C.navy })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [t("Product Architecture & Runtime Overview", { size: 24, color: C.textLight, italics: true, font: "Arial" })] }),
        spacer(600),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [t("XGBoost + SHAP  |  Next.js + Vercel  |  WeChat Miniprogram", { size: 20, color: C.textLight })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [t("v2.0  |  2026-03", { size: 20, color: C.textLight })] }),
      ],
    },

    // ════════════════════ MAIN CONTENT ════════════════════
    {
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 } },
      },
      headers: {
        default: new Header({ children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: C.medGray, space: 4 } },
          children: [t("Gold Monitor", { size: 16, color: C.gold, bold: true }), t("  |  System Architecture", { size: 16, color: C.textLight })],
        })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [t("- ", { size: 16, color: C.textLight }), new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: C.textLight }), t(" -", { size: 16, color: C.textLight })],
        })] }),
      },
      children: [

        // ──────── 1. SYSTEM OVERVIEW ────────
        heading1("一、系统总览 System Overview"),

        para("Gold Monitor 是一个端到端的黄金宏观因子量化交易系统，覆盖从数据采集、因子工程、模型训练、信号生成到可视化展示的完整链路。", { indent: true }),

        spacer(120),

        // HIGH-LEVEL ARCHITECTURE DIAGRAM
        archBox("LAYER 0  |  外部数据源 External Data Sources", "", [
          new Paragraph({ children: [
            t("FRED API", { bold: true, color: C.extBlue, size: 18 }),
            t(" (DXY, TIPS_10Y, BEI, GPR)    ", { size: 17, color: C.textMed }),
            t("Yahoo Finance", { bold: true, color: C.extBlue, size: 18 }),
            t(" (XAUUSD, ^GVZ, ^OVX)    ", { size: 17, color: C.textMed }),
            t("Stooq", { bold: true, color: C.extBlue, size: 18 }),
            t(" (GLD, GDX, GDXJ, IAU)", { size: 17, color: C.textMed }),
          ] }),
        ], C.extBlue, C.extBlueBg),

        flowArrow("API 调用 / HTTP GET"),

        archBox("LAYER 1  |  数据管道 Python Pipeline", "gold-dashboard/pipeline/", [
          new Paragraph({ children: [
            t("fetch_data.py", { bold: true, color: C.pipeGreen, size: 18, font: "Menlo" }),
            t(" → ", { size: 18 }),
            t("features.py", { bold: true, color: C.pipeGreen, size: 18, font: "Menlo" }),
            t(" → ", { size: 18 }),
            t("train.py", { bold: true, color: C.pipeGreen, size: 18, font: "Menlo" }),
            t(" → ", { size: 18 }),
            t("inference.py", { bold: true, color: C.pipeGreen, size: 18, font: "Menlo" }),
            t(" → ", { size: 18 }),
            t("backtest.py", { bold: true, color: C.pipeGreen, size: 18, font: "Menlo" }),
          ] }),
          new Paragraph({ spacing: { before: 40 }, children: [
            t("输出 9 个 JSON: ", { size: 17, color: C.textMed }),
            t("signal / shap_values / regime / correlation / ic_history / model_health / equity_curve / account / positions", { size: 16, color: C.pipeGreen, font: "Menlo" }),
          ] }),
        ], C.pipeGreen, C.pipeBg),

        flowArrow("JSON 文件读取 (readPipelineJson)"),

        archBox("LAYER 2  |  API 网关 Next.js API Routes", "gold-dashboard/src/app/api/", [
          new Paragraph({ children: [
            t("11 个 REST 端点: ", { size: 17, color: C.textMed }),
            t("/signal  /shap  /factors  /gold-price  /regime  /correlation  /ic-history  /model-health  /equity-curve  /account  /positions", { size: 16, color: C.apiBrown, font: "Menlo" }),
          ] }),
          new Paragraph({ spacing: { before: 40 }, children: [
            t("混合数据源: Pipeline JSON + 实时 FRED/Yahoo/Stooq API 调用 + 多层降级", { size: 17, color: C.textMed }),
          ] }),
        ], C.apiBrown, C.apiBg),

        flowArrow("SWR Hooks (60s/3600s 轮询)"),

        twoCol(
          // Left: Web Dashboard
          [archBox("LAYER 3A  |  Web 仪表板", "Next.js + Recharts", [
            new Paragraph({ children: [t("TopBar / LeftPanel / RightSidebar / StatusBar", { size: 17, color: C.feBlue, font: "Menlo" })] }),
            new Paragraph({ spacing: { before: 30 }, children: [t("5个图表 + 4个卡片 + 7个因子卡片 + 状态栏", { size: 17, color: C.textMed })] }),
          ], C.feBlue, C.feBg, 4580)],
          // Right: Miniprogram
          [archBox("LAYER 3B  |  微信小程序", "WeChat Miniprogram", [
            new Paragraph({ children: [t("index / factors / account / backtest", { size: 17, color: C.miniTeal, font: "Menlo" })] }),
            new Paragraph({ spacing: { before: 30 }, children: [t("4个页面 + Vercel API 远程调用", { size: 17, color: C.textMed })] }),
          ], C.miniTeal, C.miniBg, 4580)],
        ),

        new Paragraph({ children: [new PageBreak()] }),

        // ──────── 2. PIPELINE DETAIL ────────
        heading1("二、数据管道详解 Pipeline Architecture"),

        heading2("2.1 运行流程 run_daily.py"),

        para("每日管道通过 run_daily.py 一键执行 5 个步骤：", { indent: true }),

        dataTable(
          ["步骤", "模块", "输入", "输出", "耗时"],
          [
            ["1. 数据获取", "fetch_data.py", "FRED/Yahoo/Stooq API", "merged DataFrame (2817×31)", "~15s"],
            ["2. 因子工程", "features.py", "原始数据", "7 因子 Z-Score + target", "~1s"],
            ["3. 模型训练", "train.py", "特征矩阵", "model.json + IC/health", "~5s"],
            ["4. 推理信号", "inference.py", "最新因子 + 模型", "signal/shap/regime/corr", "~2s"],
            ["5. 回测评估", "backtest.py", "OOS特征 + 模型", "equity/account/positions", "~1s"],
          ],
          [1300, 1500, 2400, 2600, 840]
        ),

        spacer(200),

        heading2("2.2 数据源映射 Data Source Mapping"),

        dataTable(
          ["数据源", "API", "获取内容", "用途"],
          [
            ["FRED", "fredapi", "DTWEXBGS (DXY), DFII10 (TIPS), T10YIE (BEI), GEPUCURRENT (GPR)", "F1/F3/F4/F5 因子"],
            ["Yahoo Finance", "v8 Chart API", "XAUUSD (金价), ^GVZ (波动率), ^OVX", "金价 + F6"],
            ["Stooq", "stooq.com/q/d", "GLD, IAU, GDX, GDXJ", "F8 (ETF流) + F9 (矿业比)"],
          ],
          [1200, 1600, 3800, 2040]
        ),

        spacer(200),

        heading2("2.3 七因子体系 7-Factor Framework"),

        dataTable(
          ["因子ID", "名称", "数据源", "计算方法", "OOS IC"],
          [
            ["F1_DXY", "美元指数", "FRED DTWEXBGS", "252日滚动Z-Score", "+0.063"],
            ["F3_TIPS10Y", "实际利率", "FRED DFII10", "252日滚动Z-Score", "+0.322"],
            ["F4_BEI", "通胀预期", "FRED T10YIE", "252日滚动Z-Score", "-0.518"],
            ["F5_GPR", "地缘政治风险", "FRED GEPUCURRENT", "252日滚动Z-Score", "+0.312"],
            ["F6_GVZ", "黄金波动率", "Yahoo ^GVZ", "252日滚动Z-Score", "-0.488"],
            ["F8_ETFFlow", "ETF资金流", "Stooq GLD+IAU", "AUM变化率 Z-Score", "-0.052"],
            ["F9_GDXRatio", "矿业股/金价比", "Stooq GDX+GDXJ / XAUUSD", "均值回归 Z-Score", "+0.222"],
          ],
          [1100, 1300, 1700, 2200, 900]
        ),

        spacer(200),

        heading2("2.4 模型配置 XGBoost Parameters"),

        twoCol(
          [dataTable(
            ["参数", "值"],
            [
              ["max_depth", "3"],
              ["min_child_weight", "30"],
              ["learning_rate", "0.03"],
              ["n_estimators", "300"],
              ["subsample", "0.7"],
              ["colsample_bytree", "0.7"],
              ["reg_alpha (L1)", "1.0"],
              ["reg_lambda (L2)", "5.0"],
            ],
            [2800, 1680]
          )],
          [dataTable(
            ["信号阈值", "预测收益率"],
            [
              ["Strong Buy", "> +0.8%"],
              ["Buy", "+0.3% ~ +0.8%"],
              ["Neutral", "-0.3% ~ +0.3%"],
              ["Sell", "-0.8% ~ -0.3%"],
              ["Strong Sell", "< -0.8%"],
            ],
            [2800, 1680]
          )],
        ),

        spacer(200),

        heading2("2.5 输出文件 Pipeline Outputs"),

        dataTable(
          ["文件", "内容", "更新频率", "消费者"],
          [
            ["signal.json", "当日信号、预测收益、置信度、因子值、止损/止盈", "每日", "/api/signal, /api/factors"],
            ["shap_values.json", "SHAP 归因(base_value + 7因子贡献)", "每日", "/api/shap → ShapWaterfall"],
            ["regime.json", "当前Regime + 12个月热力图", "每日", "/api/regime → RegimeHeatmap"],
            ["correlation.json", "7×7 Spearman 相关矩阵", "每日", "/api/correlation → CorrelationMatrix"],
            ["ic_history.json", "滚动IC序列 + 因子IC + CV均值IC", "每日", "/api/ic-history → ICTracking"],
            ["model_health.json", "模型状态/warnings/OOS IC/共线性", "每日", "/api/model-health → StatusBar"],
            ["equity_curve.json", "184天OOS净值 + GLD基准", "每日", "/api/equity-curve → EquityCurve"],
            ["account.json", "回测统计(收益/Sharpe/胜率/回撤)", "每日", "/api/account → AccountCard"],
            ["positions.json", "当前持仓 + 最近20笔交易", "每日", "/api/positions → PositionCard"],
          ],
          [1700, 3200, 800, 2940]
        ),

        new Paragraph({ children: [new PageBreak()] }),

        // ──────── 3. API LAYER ────────
        heading1("三、API 网关层 API Gateway Layer"),

        heading2("3.1 端点总览 11 API Endpoints"),

        dataTable(
          ["端点", "数据源", "刷新频率", "降级策略"],
          [
            ["/api/gold-price", "Yahoo v7 → v8 → Stooq → Pipeline → Mock", "60s (SWR)", "4层降级"],
            ["/api/signal", "Pipeline signal.json", "60min", "空信号 fallback"],
            ["/api/shap", "Pipeline shap_values.json", "60min", "空数组 fallback"],
            ["/api/factors", "FRED + Yahoo + Pipeline + Mock", "60min", "Mock因子形状"],
            ["/api/regime", "Pipeline regime.json", "60min", "Neutral fallback"],
            ["/api/correlation", "Pipeline correlation.json", "60min", "空矩阵"],
            ["/api/ic-history", "Pipeline ic_history.json", "60min", "空序列"],
            ["/api/model-health", "Pipeline model_health.json", "60min", "unknown 状态"],
            ["/api/equity-curve", "Pipeline equity_curve.json", "60min", "空数组"],
            ["/api/account", "Pipeline account.json", "60min", "零值 fallback"],
            ["/api/positions", "Pipeline positions.json", "60min", "空持仓"],
          ],
          [1800, 3200, 1200, 2440]
        ),

        spacer(200),

        heading2("3.2 金价数据 4 层降级架构"),

        archBox("Priority 1: Yahoo v7 Quotes API", "", [
          new Paragraph({ children: [mono("GET query1.finance.yahoo.com/v7/finance/quote?symbols=GC=F", { size: 16 })] }),
          new Paragraph({ spacing: { before: 30 }, children: [t("需要 crumb 认证，经常失败", { size: 17, color: C.red })] }),
        ], C.red, C.redBg),

        flowArrow("失败时"),

        archBox("Priority 2: Yahoo v8 Chart API (主力源)", "", [
          new Paragraph({ children: [mono("GET query2.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=1d", { size: 16 })] }),
          new Paragraph({ spacing: { before: 30 }, children: [t("无需 crumb，最稳定的数据源", { size: 17, color: C.green })] }),
        ], C.green, C.greenBg),

        flowArrow("失败时"),

        archBox("Priority 3: Stooq", "", [
          new Paragraph({ children: [mono("GET stooq.com/q/l/?s=xauusd&f=sd2t2ohlcv&e=csv", { size: 16 })] }),
          new Paragraph({ spacing: { before: 30 }, children: [t("CSV 格式，有频率限制", { size: 17, color: C.orange })] }),
        ], C.orange, C.orangeBg),

        flowArrow("失败时"),

        archBox("Priority 4: Pipeline signal.json", "", [
          new Paragraph({ children: [mono("readPipelineJson('signal.json') → gold_price", { size: 16 })] }),
          new Paragraph({ spacing: { before: 30 }, children: [t("离线数据兜底，可能延迟1天", { size: 17, color: C.textMed })] }),
        ], C.blue, C.blueBg),

        new Paragraph({ children: [new PageBreak()] }),

        // ──────── 4. FRONTEND ────────
        heading1("四、前端架构 Frontend Architecture"),

        heading2("4.1 页面布局 Page Layout"),

        para("Web 仪表板采用三栏布局，移动端自适应为上下堆叠："),

        // Layout diagram
        new Table({
          width: { size: 9640, type: WidthType.DXA },
          columnWidths: [9640],
          rows: [
            // TopBar
            new TableRow({ children: [new TableCell({
              borders, width: { size: 9640, type: WidthType.DXA },
              shading: { fill: C.navy, type: ShadingType.CLEAR },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
                t("TopBar", { size: 18, bold: true, color: C.white }),
                t("  |  Logo + 金价实时行情 + 7个因子卡片", { size: 16, color: "CCCCCC" }),
              ] })],
            })] }),
          ],
        }),
        new Table({
          width: { size: 9640, type: WidthType.DXA },
          columnWidths: [5840, 3800],
          rows: [
            new TableRow({ children: [
              // LeftPanel
              new TableCell({
                borders, width: { size: 5840, type: WidthType.DXA },
                shading: { fill: C.feBg, type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [
                  new Paragraph({ children: [t("LeftPanel", { size: 18, bold: true, color: C.feBlue })] }),
                  new Paragraph({ spacing: { before: 40 }, children: [t("5 个标签页:", { size: 16, color: C.textMed })] }),
                  new Paragraph({ spacing: { before: 20 }, children: [t("SHAP归因 | IC追踪 | Regime热力图 | 相关性矩阵 | 净值曲线", { size: 16, color: C.feBlue })] }),
                  new Paragraph({ spacing: { before: 40 }, children: [t("组件: ShapWaterfall, ICTracking, RegimeHeatmap, CorrelationMatrix, EquityCurveChart", { size: 14, color: C.textLight, font: "Menlo" })] }),
                ],
              }),
              // RightSidebar
              new TableCell({
                borders, width: { size: 3800, type: WidthType.DXA },
                shading: { fill: "FFF8E1", type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [
                  new Paragraph({ children: [t("RightSidebar", { size: 18, bold: true, color: C.gold })] }),
                  spacer(30),
                  new Paragraph({ children: [t("SignalCard", { size: 16, color: C.gold }), t(" 信号+置信度+Regime", { size: 14, color: C.textMed })] }),
                  new Paragraph({ spacing: { before: 20 }, children: [t("ShapWaterfall", { size: 16, color: C.gold }), t(" (移动端)", { size: 14, color: C.textMed })] }),
                  new Paragraph({ spacing: { before: 20 }, children: [t("PositionCard", { size: 16, color: C.gold }), t(" 持仓+交易记录", { size: 14, color: C.textMed })] }),
                  new Paragraph({ spacing: { before: 20 }, children: [t("AccountCard", { size: 16, color: C.gold }), t(" 净值+风控+指标", { size: 14, color: C.textMed })] }),
                ],
              }),
            ] }),
          ],
        }),
        new Table({
          width: { size: 9640, type: WidthType.DXA },
          columnWidths: [9640],
          rows: [
            new TableRow({ children: [new TableCell({
              borders, width: { size: 9640, type: WidthType.DXA },
              shading: { fill: "E8EAF6", type: ShadingType.CLEAR },
              margins: { top: 50, bottom: 50, left: 120, right: 120 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
                t("StatusBar", { size: 18, bold: true, color: C.accent }),
                t("  |  模型状态 + OOS IC + 数据新鲜度 + 因子数 + 警告", { size: 16, color: C.textMed }),
              ] })],
            })] }),
          ],
        }),

        spacer(200),

        heading2("4.2 数据流 Frontend Data Flow"),

        dataTable(
          ["SWR Hook", "API 端点", "刷新频率", "消费组件"],
          [
            ["useGoldPrice()", "/api/gold-price", "60 秒", "TopBar"],
            ["useFactors()", "/api/factors", "60 分钟", "TopBar (FactorCard ×7)"],
            ["useSignal()", "/api/signal", "60 分钟", "RightSidebar → SignalCard"],
            ["useShapValues()", "/api/shap", "60 分钟", "LeftPanel + RightSidebar → ShapWaterfall"],
            ["useICHistory()", "/api/ic-history", "60 分钟", "LeftPanel → ICTracking"],
            ["useRegime()", "/api/regime", "60 分钟", "LeftPanel → RegimeHeatmap"],
            ["useCorrelation()", "/api/correlation", "60 分钟", "LeftPanel → CorrelationMatrix"],
            ["useEquityCurve()", "/api/equity-curve", "60 分钟", "LeftPanel + AccountCard → EquityCurve"],
            ["usePositions()", "/api/positions", "60 分钟", "RightSidebar → PositionCard"],
            ["useAccount()", "/api/account", "60 分钟", "RightSidebar → AccountCard"],
            ["useModelHealth()", "/api/model-health", "60 分钟", "StatusBar"],
          ],
          [1800, 1800, 1000, 4040]
        ),

        new Paragraph({ children: [new PageBreak()] }),

        // ──────── 5. MINIPROGRAM ────────
        heading1("五、微信小程序 WeChat Miniprogram"),

        heading2("5.1 页面结构"),

        dataTable(
          ["页面", "路径", "功能", "调用API"],
          [
            ["首页概览", "pages/index/", "金价+信号+7因子卡片+Regime", "/gold-price, /signal, /factors, /regime"],
            ["因子分析", "pages/factors/", "7因子详情+SHAP归因", "/factors, /shap"],
            ["账户概览", "pages/account/", "净值+持仓+交易记录", "/equity-curve, /positions"],
            ["回测报告", "pages/backtest/", "IC追踪+回测曲线", "/ic-history, /equity-curve"],
          ],
          [1200, 1600, 2800, 3040]
        ),

        spacer(100),

        heading2("5.2 数据链路"),

        para("小程序通过 Vercel 部署的 Next.js API 获取所有数据，数据链路为："),

        archBox("WeChat Miniprogram → Vercel API → Pipeline JSON", "", [
          new Paragraph({ children: [
            t("utils/api.js", { bold: true, size: 18, font: "Menlo", color: C.miniTeal }),
            t(" → ", { size: 18 }),
            t("wx.request()", { size: 18, font: "Menlo", color: C.textMed }),
            t(" → ", { size: 18 }),
            t("https://gold-monitor-delta.vercel.app/api/*", { size: 17, font: "Menlo", color: C.miniTeal }),
          ] }),
          new Paragraph({ spacing: { before: 40 }, children: [
            t("8 个 API 函数: fetchGoldPrice / fetchSignal / fetchFactors / fetchShap / fetchRegime / fetchPositions / fetchEquityCurve / fetchICHistory", { size: 16, color: C.textMed }),
          ] }),
        ], C.miniTeal, C.miniBg),

        spacer(300),

        // ──────── 6. TECH STACK ────────
        heading1("六、技术栈 Technology Stack"),

        threeCol(
          // Column 1: Pipeline
          [archBox("数据管道", "Python", [
            new Paragraph({ children: [t("Python 3.9+", { bold: true, size: 17 })] }),
            new Paragraph({ children: [t("XGBoost 2.x", { size: 17, color: C.textMed })] }),
            new Paragraph({ children: [t("SHAP (TreeExplainer)", { size: 17, color: C.textMed })] }),
            new Paragraph({ children: [t("Pandas / NumPy / SciPy", { size: 17, color: C.textMed })] }),
            new Paragraph({ children: [t("fredapi", { size: 17, color: C.textMed })] }),
          ], C.pipeGreen, C.pipeBg, 3020)],
          // Column 2: Web
          [archBox("Web 前端", "TypeScript", [
            new Paragraph({ children: [t("Next.js 14 (App Router)", { bold: true, size: 17 })] }),
            new Paragraph({ children: [t("React 18 + SWR", { size: 17, color: C.textMed })] }),
            new Paragraph({ children: [t("Recharts (图表)", { size: 17, color: C.textMed })] }),
            new Paragraph({ children: [t("Tailwind CSS", { size: 17, color: C.textMed })] }),
            new Paragraph({ children: [t("Vercel 部署", { size: 17, color: C.textMed })] }),
          ], C.feBlue, C.feBg, 3020)],
          // Column 3: Mini
          [archBox("微信小程序", "JavaScript", [
            new Paragraph({ children: [t("WXML + WXSS + JS", { bold: true, size: 17 })] }),
            new Paragraph({ children: [t("wx.request (HTTP)", { size: 17, color: C.textMed })] }),
            new Paragraph({ children: [t("wx-charts (图表)", { size: 17, color: C.textMed })] }),
            new Paragraph({ children: [t("4 个页面", { size: 17, color: C.textMed })] }),
            new Paragraph({ children: [t("微信开发者工具", { size: 17, color: C.textMed })] }),
          ], C.miniTeal, C.miniBg, 3020)],
        ),

        new Paragraph({ children: [new PageBreak()] }),

        // ──────── 7. FILE TREE ────────
        heading1("七、项目文件结构 Project File Tree"),

        new Table({
          width: { size: 9640, type: WidthType.DXA },
          columnWidths: [9640],
          rows: [new TableRow({ children: [new TableCell({
            borders: { ...borders, left: thickBorder(C.navy) },
            width: { size: 9640, type: WidthType.DXA },
            shading: { fill: "F8F9FA", type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 200, right: 200 },
            children: [
              ...[
                "GoldMonitor/",
                "\u251C\u2500\u2500 gold-dashboard/",
                "\u2502   \u251C\u2500\u2500 pipeline/                    \u2190 Python \u6570\u636E\u7BA1\u9053",
                "\u2502   \u2502   \u251C\u2500\u2500 config.py                \u2190 \u56E0\u5B50/\u6A21\u578B/\u9608\u503C\u914D\u7F6E",
                "\u2502   \u2502   \u251C\u2500\u2500 fetch_data.py            \u2190 FRED + Yahoo + Stooq \u6570\u636E\u83B7\u53D6",
                "\u2502   \u2502   \u251C\u2500\u2500 features.py              \u2190 7\u56E0\u5B50 Z-Score \u5DE5\u7A0B",
                "\u2502   \u2502   \u251C\u2500\u2500 train.py                 \u2190 XGBoost \u8BAD\u7EC3 + IC + \u5065\u5EB7\u68C0\u67E5",
                "\u2502   \u2502   \u251C\u2500\u2500 inference.py             \u2190 \u63A8\u7406 + SHAP + Regime + \u76F8\u5173\u6027",
                "\u2502   \u2502   \u251C\u2500\u2500 backtest.py              \u2190 OOS \u56DE\u6D4B\u5F15\u64CE",
                "\u2502   \u2502   \u251C\u2500\u2500 run_daily.py             \u2190 \u4E00\u952E\u8FD0\u884C\u5168\u6D41\u7A0B",
                "\u2502   \u2502   \u251C\u2500\u2500 model.json               \u2190 XGBoost \u6A21\u578B\u6587\u4EF6",
                "\u2502   \u2502   \u2514\u2500\u2500 output/                  \u2190 9 \u4E2A JSON \u8F93\u51FA",
                "\u2502   \u2502       \u251C\u2500\u2500 signal.json / shap_values.json / regime.json",
                "\u2502   \u2502       \u251C\u2500\u2500 correlation.json / ic_history.json / model_health.json",
                "\u2502   \u2502       \u2514\u2500\u2500 equity_curve.json / account.json / positions.json",
                "\u2502   \u251C\u2500\u2500 src/",
                "\u2502   \u2502   \u251C\u2500\u2500 app/",
                "\u2502   \u2502   \u2502   \u251C\u2500\u2500 page.tsx                 \u2190 \u4E3B\u9875\u9762 (3\u680F\u5E03\u5C40)",
                "\u2502   \u2502   \u2502   \u251C\u2500\u2500 layout.tsx               \u2190 \u5168\u5C40\u5E03\u5C40 + \u5B57\u4F53",
                "\u2502   \u2502   \u2502   \u2514\u2500\u2500 api/                     \u2190 11 \u4E2A API \u7AEF\u70B9",
                "\u2502   \u2502   \u2502       \u251C\u2500\u2500 gold-price/route.ts  \u2190 4\u5C42\u964D\u7EA7\u91D1\u4EF7",
                "\u2502   \u2502   \u2502       \u251C\u2500\u2500 signal/route.ts      \u2190 Pipeline JSON",
                "\u2502   \u2502   \u2502       \u251C\u2500\u2500 shap/route.ts        \u2190 Pipeline JSON",
                "\u2502   \u2502   \u2502       \u251C\u2500\u2500 factors/route.ts     \u2190 FRED+Yahoo+Pipeline",
                "\u2502   \u2502   \u2502       \u2514\u2500\u2500 ... (7 more)",
                "\u2502   \u2502   \u251C\u2500\u2500 components/",
                "\u2502   \u2502   \u2502   \u251C\u2500\u2500 layout/  TopBar | LeftPanel | RightSidebar | StatusBar",
                "\u2502   \u2502   \u2502   \u251C\u2500\u2500 cards/   SignalCard | FactorCard | PositionCard | AccountCard",
                "\u2502   \u2502   \u2502   \u251C\u2500\u2500 charts/  ShapWaterfall | ICTracking | RegimeHeatmap | CorrelationMatrix | EquityCurve",
                "\u2502   \u2502   \u2502   \u2514\u2500\u2500 ui/      Badge | ProgressBar",
                "\u2502   \u2502   \u251C\u2500\u2500 lib/",
                "\u2502   \u2502   \u2502   \u251C\u2500\u2500 useGoldData.ts           \u2190 11 \u4E2A SWR Hooks",
                "\u2502   \u2502   \u2502   \u251C\u2500\u2500 readPipelineJson.ts      \u2190 Pipeline JSON \u8BFB\u53D6\u5DE5\u5177",
                "\u2502   \u2502   \u2502   \u251C\u2500\u2500 fred.ts / yahoo.ts / stooq.ts  \u2190 \u5916\u90E8 API \u5BA2\u6237\u7AEF",
                "\u2502   \u2502   \u2514\u2500\u2500 types/index.ts           \u2190 TypeScript \u7C7B\u578B\u5B9A\u4E49",
                "\u251C\u2500\u2500 miniprogram/",
                "\u2502   \u251C\u2500\u2500 app.js                       \u2190 API Base URL \u914D\u7F6E",
                "\u2502   \u251C\u2500\u2500 utils/api.js                 \u2190 8 \u4E2A API \u51FD\u6570",
                "\u2502   \u2514\u2500\u2500 pages/",
                "\u2502       \u251C\u2500\u2500 index/    \u2190 \u9996\u9875\u6982\u89C8 (\u91D1\u4EF7+\u4FE1\u53F7+\u56E0\u5B50)",
                "\u2502       \u251C\u2500\u2500 factors/  \u2190 \u56E0\u5B50\u5206\u6790 (7\u56E0\u5B50\u8BE6\u60C5)",
                "\u2502       \u251C\u2500\u2500 account/  \u2190 \u8D26\u6237\u6982\u89C8 (\u51C0\u503C+\u6301\u4ED3)",
                "\u2502       \u2514\u2500\u2500 backtest/ \u2190 \u56DE\u6D4B\u62A5\u544A (IC+\u8D44\u4EA7\u66F2\u7EBF)",
                "\u2514\u2500\u2500 docs/                        \u2190 \u6587\u6863",
              ].map(line => new Paragraph({
                spacing: { before: 10, after: 10 },
                children: [new TextRun({ text: line, font: "Menlo", size: 16, color: C.textDark })],
              })),
            ],
          })] })],
        }),

        new Paragraph({ children: [new PageBreak()] }),

        // ──────── 8. RUNTIME FLOW ────────
        heading1("八、运行时序 Runtime Sequence"),

        heading2("8.1 每日管道运行 (Python, 本地/CI)"),

        dataTable(
          ["时序", "动作", "模块", "产出"],
          [
            ["T+0s", "启动 run_daily.py", "run_daily", "—"],
            ["T+1s", "调用 FRED API 获取 DXY/TIPS/BEI/GPR", "fetch_data", "DataFrame"],
            ["T+10s", "调用 Yahoo/Stooq 获取金价/ETF/矿业股", "fetch_data", "合并 DataFrame (2817×31)"],
            ["T+15s", "计算7因子 Z-Score + 20日前瞻收益", "features", "特征矩阵"],
            ["T+16s", "Purged TSCV 训练 XGBoost (若需)", "train", "model.json"],
            ["T+18s", "最新因子 → 模型预测 → 信号分类", "inference", "signal.json"],
            ["T+19s", "SHAP TreeExplainer 计算归因", "inference", "shap_values.json"],
            ["T+20s", "Regime 检测 + 相关性矩阵", "inference", "regime.json, correlation.json"],
            ["T+21s", "OOS 回测 184 天", "backtest", "equity/account/positions"],
            ["T+23s", "管道完成，9个 JSON 更新", "run_daily", "全部输出"],
          ],
          [800, 3000, 1200, 3640]
        ),

        spacer(200),

        heading2("8.2 用户访问时序 (浏览器/小程序)"),

        dataTable(
          ["时序", "动作", "触发", "数据流"],
          [
            ["0ms", "用户打开仪表板", "页面加载", "—"],
            ["50ms", "React 渲染骨架", "Next.js SSR", "fallback 数据"],
            ["100ms", "SWR 发起 11 个 API 请求", "useGoldPrice 等", "GET /api/*"],
            ["200ms", "API Route 读取 Pipeline JSON", "readPipelineJson", "fs.readFile"],
            ["250ms", "gold-price 调用 Yahoo v8", "fetch", "HTTP → Yahoo"],
            ["500ms", "API 返回 JSON 响应", "NextResponse", "JSON → SWR"],
            ["600ms", "组件接收数据并重渲染", "SWR mutate", "Charts 更新"],
            ["+60s", "金价自动刷新", "SWR refreshInterval", "GET /api/gold-price"],
            ["+60min", "全部数据刷新", "SWR refreshInterval", "GET /api/* (全部)"],
          ],
          [800, 2800, 2000, 3040]
        ),

        spacer(200),

        heading2("8.3 微信小程序时序"),

        dataTable(
          ["时序", "动作", "模块", "数据流"],
          [
            ["0ms", "用户打开小程序", "app.js onLaunch", "—"],
            ["100ms", "首页发起 API 请求", "index.js onLoad", "wx.request → Vercel"],
            ["300ms", "Vercel CDN 响应", "Next.js API", "JSON 响应"],
            ["400ms", "WXML 模板渲染", "setData()", "因子卡片 + 信号"],
            ["切换页面", "因子/账户/回测页加载", "各页面 onLoad", "按需请求 API"],
          ],
          [1000, 2800, 2000, 2840]
        ),

        spacer(300),

        // ──────── CLOSING ────────
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: C.gold, space: 16 } },
          spacing: { before: 200, after: 60 },
          children: [t("Gold Monitor v2.0  |  7 Factors  |  11 APIs  |  3 Platforms", { size: 22, color: C.textLight, font: "Arial" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [t("End-to-end quantitative trading intelligence for gold markets.", { size: 20, color: C.textLight, italics: true, font: "Arial" })],
        }),
      ],
    },
  ],
});

// ── Generate ──
const OUTPUT = "/Users/vivienna/Desktop/VibeCoding/GoldMonitor/GoldMonitor_产品架构与运行全景图.docx";
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(OUTPUT, buffer);
  console.log(`Created: ${OUTPUT} (${(buffer.length / 1024).toFixed(0)} KB)`);
});
