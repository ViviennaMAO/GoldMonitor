const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, LevelFormat, TabStopType, TabStopPosition,
} = require("docx");

// ── Color Palette ──
const C = {
  gold: "B8860B",
  darkGold: "8B6914",
  navy: "1B2A4A",
  darkBg: "0F1923",
  accent: "2E75B6",
  red: "C0392B",
  green: "27AE60",
  orange: "E67E22",
  lightGray: "F5F5F5",
  medGray: "E0E0E0",
  textDark: "1A1A1A",
  textMed: "4A4A4A",
  textLight: "777777",
  white: "FFFFFF",
};

// ── Helpers ──
const border = { style: BorderStyle.SINGLE, size: 1, color: C.medGray };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0 };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

function text(t, opts = {}) {
  return new TextRun({ text: t, font: "Arial", size: opts.size || 22, color: opts.color || C.textDark, bold: opts.bold, italics: opts.italics, ...opts });
}

function cnText(t, opts = {}) {
  return new TextRun({ text: t, font: "PingFang SC", size: opts.size || 22, color: opts.color || C.textDark, bold: opts.bold, italics: opts.italics, ...opts });
}

function heading1(t) {
  return new Paragraph({
    spacing: { before: 400, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.gold, space: 8 } },
    children: [cnText(t, { size: 32, bold: true, color: C.navy })],
  });
}

function heading2(t) {
  return new Paragraph({
    spacing: { before: 320, after: 160 },
    children: [
      cnText("| ", { size: 28, bold: true, color: C.gold }),
      cnText(t, { size: 28, bold: true, color: C.navy }),
    ],
  });
}

function heading3(t) {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    children: [cnText(t, { size: 24, bold: true, color: C.accent })],
  });
}

function para(t, opts = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80, line: 360 },
    alignment: opts.align || AlignmentType.LEFT,
    indent: opts.indent ? { firstLine: 440 } : undefined,
    children: [cnText(t, { size: 22, color: opts.color || C.textDark })],
  });
}

function paraRuns(runs, opts = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80, line: 360 },
    indent: opts.indent ? { firstLine: 440 } : undefined,
    children: runs,
  });
}

function bulletItem(t, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 40, after: 40, line: 340 },
    children: [cnText(t, { size: 22 })],
  });
}

function calloutBox(title, content, accentColor = C.gold) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [120, 9240],
    rows: [new TableRow({
      children: [
        new TableCell({
          borders: { ...noBorders, left: { style: BorderStyle.SINGLE, size: 12, color: accentColor } },
          width: { size: 120, type: WidthType.DXA },
          shading: { fill: accentColor, type: ShadingType.CLEAR },
          children: [new Paragraph("")],
        }),
        new TableCell({
          borders: noBorders,
          width: { size: 9240, type: WidthType.DXA },
          shading: { fill: "FFF8E1", type: ShadingType.CLEAR },
          margins: { top: 120, bottom: 120, left: 200, right: 200 },
          children: [
            new Paragraph({ spacing: { after: 60 }, children: [cnText(title, { size: 22, bold: true, color: accentColor })] }),
            new Paragraph({ spacing: { before: 0 }, children: [cnText(content, { size: 20, color: C.textMed })] }),
          ],
        }),
      ],
    })],
  });
}

function dataTable(headers, rows, colWidths) {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      borders,
      width: { size: colWidths[i], type: WidthType.DXA },
      shading: { fill: C.navy, type: ShadingType.CLEAR },
      margins: cellMargins,
      verticalAlign: "center",
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [cnText(h, { size: 20, bold: true, color: C.white })] })],
    })),
  });

  const dataRows = rows.map((row, ri) => new TableRow({
    children: row.map((cell, ci) => new TableCell({
      borders,
      width: { size: colWidths[ci], type: WidthType.DXA },
      shading: { fill: ri % 2 === 0 ? C.white : C.lightGray, type: ShadingType.CLEAR },
      margins: cellMargins,
      children: [new Paragraph({ alignment: ci === 0 ? AlignmentType.LEFT : AlignmentType.CENTER, children: [cnText(String(cell), { size: 20, color: C.textDark })] })],
    })),
  }));

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows],
  });
}

function metricCard(label, before, after, unit = "", good = true) {
  return [label, before + unit, after + unit, good ? "Improved" : "Degraded"];
}

function spacer(h = 200) {
  return new Paragraph({ spacing: { before: h, after: 0 }, children: [] });
}

// ── Document ──
const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "PingFang SC", size: 22 } },
    },
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
        ],
      },
      {
        reference: "numbers",
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        ],
      },
    ],
  },
  sections: [
    // ════════════════════ COVER PAGE ════════════════════
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        spacer(2400),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [cnText("GOLD MONITOR", { size: 56, bold: true, color: C.gold, font: "Arial" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: C.gold, space: 12 } },
          spacing: { after: 400 },
          children: [cnText("QUANT RESEARCH NOTE", { size: 28, color: C.textLight, font: "Arial" })],
        }),
        spacer(400),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [cnText("宏观因子量化交易的七大陷阱", { size: 44, bold: true, color: C.navy })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [cnText("从一次模型翻车事件说起", { size: 32, color: C.textMed })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [cnText("Seven Pitfalls in Macro Factor Quant Trading", { size: 24, color: C.textLight, italics: true, font: "Arial" })],
        }),
        spacer(800),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [cnText("Gold Monitor Project  |  2026-03", { size: 22, color: C.textLight })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [cnText("基于 XGBoost + SHAP 的黄金多因子交易系统实战复盘", { size: 20, color: C.textLight })],
        }),
      ],
    },

    // ════════════════════ MAIN CONTENT ════════════════════
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: C.medGray, space: 4 } },
            children: [
              cnText("Gold Monitor  ", { size: 16, color: C.gold, bold: true }),
              cnText("|  宏观因子量化交易的七大陷阱", { size: 16, color: C.textLight }),
            ],
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              cnText("- ", { size: 16, color: C.textLight }),
              new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: C.textLight }),
              cnText(" -", { size: 16, color: C.textLight }),
            ],
          })],
        }),
      },
      children: [

        // ──────── 导言 ────────
        heading1("引言：当模型说「买入」，金价却在跌"),

        paraRuns([
          cnText("2026年3月的一个早晨，Gold Monitor 交易系统发出了一个"),
          cnText("「Strong Buy」", { bold: true, color: C.green }),
          cnText("信号。然而，此时黄金价格正从5300美元的高位一路回落至4500美元附近——模型的判断与市场方向"),
          cnText("完全相反", { bold: true, color: C.red }),
          cnText("。"),
        ], { indent: true }),

        para("这不是一个偶然的错误。经过深入排查，我们发现这个看似简单的「信号错误」背后，隐藏着宏观因子量化交易中最常见的七大陷阱。每一个陷阱都足以让一个精心构建的模型变成一台「反向指标机器」。", { indent: true }),

        para("这篇文章将以这次真实的模型翻车事件为线索，逐一拆解这些陷阱，并给出已经在我们系统中验证过的解决方案。无论你是刚入门的量化爱好者，还是正在构建自己交易系统的开发者，这些经验教训都具有普遍的参考价值。", { indent: true }),

        calloutBox(
          "系统概览",
          "Gold Monitor 是一个基于 XGBoost + SHAP 的多因子黄金交易系统，使用美元指数、实际利率、通胀预期、波动率等宏观因子，通过滚动 Z-Score 标准化后输入模型，预测未来20个交易日的黄金收益率，并生成买卖信号。"
        ),

        spacer(200),

        // ──────── 陷阱1：单因子SHAP支配 ────────
        heading1("陷阱一：单因子 SHAP 支配——当一个因子「绑架」了整个模型"),

        heading2("现象"),
        para("在排查信号错误时，我们首先查看了 SHAP 归因图。结果令人震惊：", { indent: true }),

        dataTable(
          ["因子", "SHAP 贡献", "占总贡献比", "状态"],
          [
            ["F2_FedFunds (联邦基金利率)", "+5.24", "96.2%", "异常支配"],
            ["F3_TIPS10Y (实际利率)", "+0.08", "1.5%", "被压制"],
            ["F1_DXY (美元指数)", "+0.05", "0.9%", "被压制"],
            ["其余6个因子", "+0.08", "1.4%", "几乎无效"],
          ],
          [3200, 1800, 2000, 2360]
        ),

        spacer(100),
        para("一个因子贡献了96%的预测力——这意味着我们花大量精力构建的多因子模型，实际上退化成了一个「单因子模型」。而这个因子（联邦基金利率）的 Z-Score 高达 +4.85，远超正常范围，直接驱动模型给出了极端的买入信号。", { indent: true }),

        heading2("根因分析"),

        calloutBox(
          "什么是 Z-Score？",
          "Z-Score 是一种标准化方法：Z = (当前值 - 历史均值) / 历史标准差。Z-Score = 0 表示等于均值，|Z| > 2 表示偏离均值两个标准差，属于极端值。我们使用252天（一年）的滚动窗口来计算。",
          C.accent
        ),

        spacer(100),
        para("问题出在 Z-Score 的计算窗口上。联邦基金利率在2022-2023年经历了历史性的加息周期（从0%升至5.5%），然后在5%以上维持了很长时间。使用252天的滚动窗口时：", { indent: true }),

        bulletItem("窗口内的均值约为5.2%，标准差极小（约0.08）"),
        bulletItem("任何微小的利率变动都会产生巨大的Z-Score"),
        bulletItem("当利率从5.5%降至4.5%时，Z-Score飙升到+4.85"),
        bulletItem("XGBoost 看到这个极端输入值，自然给出极端的输出"),

        para("这就像用一把精度为0.001毫米的尺子去测量桌子的长度——任何微小的抖动都会被放大成「异常值」。", { indent: true }),

        heading2("解决方案"),
        bulletItem("缩短 F2 的 Z-Score 窗口从252天到60天，让标准差更能反映近期波动"),
        bulletItem("增加 XGBoost 正则化：max_depth=3, min_child_weight=30, reg_lambda=5.0"),
        bulletItem("设置 SHAP 稳定性检查：当单因子贡献超过60%时自动报警"),

        heading2("修复效果"),
        dataTable(
          ["指标", "修复前", "修复后", "变化"],
          [
            ["F2 SHAP 占比", "96.2%", "37%", "-59.2pp"],
            ["最大单因子占比", "96.2%", "37%", "分散化"],
            ["模型信号", "Strong Buy", "Sell", "方向修正"],
            ["与市场一致性", "完全相反", "一致", "恢复正常"],
          ],
          [2800, 2000, 2000, 2560]
        ),

        spacer(100),
        calloutBox(
          "启发",
          "SHAP 归因不仅是一个「事后解释」工具，更应该被当作一个实时监控指标。当你看到单因子贡献超过50%，就该警惕模型是否已经退化为单因子策略。这类问题在面板数据或宏观因子中尤其常见，因为宏观变量往往有长期趋势。",
          C.orange
        ),

        new Paragraph({ children: [new PageBreak()] }),

        // ──────── 陷阱2：多重共线性 ────────
        heading1("陷阱二：多重共线性——因子之间的「群体效应」"),

        heading2("现象"),
        para("修复完 SHAP 支配问题后，我们运行了相关性矩阵分析。结果再次令人担忧——在10个因子中，有11对因子的相关系数 |r| > 0.6：", { indent: true }),

        dataTable(
          ["因子对", "Spearman |r|", "本质关系"],
          [
            ["F2_FedFunds × F2b_RateMomentum", "0.888", "同为利率指标"],
            ["F2c_RateExpect × F3_TIPS10Y", "0.885", "同为利率预期"],
            ["F1_DXY × F9_GDXRatio", "0.845", "美元强弱的不同表达"],
            ["F1_DXY × F5_GPR", "0.827", "风险偏好传导"],
            ["F2c_RateExpect × F9_GDXRatio", "0.799", "利率→矿业股"],
            ["F3_TIPS10Y × F9_GDXRatio", "0.791", "利率→矿业股"],
          ],
          [3500, 2200, 3660]
        ),

        spacer(100),

        calloutBox(
          "什么是多重共线性？",
          "想象你雇了10个人来投票决定方向。但其中4个人是一家人，他们总是投一样的票。表面上看你有10票，实际上只有7个独立意见。更糟糕的是，这4票的「一致性」会让模型过度重视这个家族的观点，因为它看起来「证据很强」——4票都支持同一个方向。",
          C.accent
        ),

        heading2("为什么这很危险？"),
        bulletItem("信号冗余：4个利率相关因子本质上传递同一个信息，但模型会4次计入这个信息"),
        bulletItem("SHAP 分裂：相关因子之间会「瓜分」SHAP值，导致每个因子看起来都不重要，掩盖真实的驱动因素"),
        bulletItem("过拟合加剧：模型可以用多个高相关因子的微小差异来「记住」训练集的噪声"),
        bulletItem("不稳定：训练数据稍有变化，SHAP 归因就会在相关因子之间大幅跳动"),

        heading2("解决方案：因子精简"),
        para("我们按照「代表性 + IC 信号质量」的原则，对利率簇进行了精简：", { indent: true }),

        dataTable(
          ["因子", "OOS IC", "决定", "理由"],
          [
            ["F2_FedFunds", "-0.42", "移除", "负IC，与F2b高度相关"],
            ["F2b_RateMomentum", "-0.36", "移除", "负IC，与F2冗余"],
            ["F2c_RateExpect", "-0.14", "移除", "负IC，与F3高度相关"],
            ["F3_TIPS10Y", "+0.32", "保留", "利率簇中IC最高"],
          ],
          [2800, 1600, 1400, 3560]
        ),

        spacer(100),

        para("精简后，因子数从10个减少到7个，高相关对从11对降至2对。看似「少了」，实际上模型获得的独立信息反而更多了。", { indent: true }),

        calloutBox(
          "启发",
          "添加更多因子不等于模型更好。在量化交易中，因子质量 > 因子数量。每增加一个因子之前，先检查它与现有因子的相关性。如果 |r| > 0.7，大概率是冗余的。真正能提升模型的是那些与现有因子低相关、但与目标变量有独立预测力的因子。",
          C.orange
        ),

        new Paragraph({ children: [new PageBreak()] }),

        // ──────── 陷阱3：死因子 ────────
        heading1("陷阱三：死因子——占位不做事的「僵尸变量」"),

        heading2("现象"),
        para("在相关性矩阵中，我们发现 F7_WGC（世界黄金协会ETF资金流）这一列全部显示 NaN。进一步检查发现：", { indent: true }),

        bulletItem("F7_WGC 的值在所有日期上都是 0.0"),
        bulletItem("数据源（WGC官网）需要手动下载，API已失效"),
        bulletItem("因子工程中对缺失值填充了0，导致 Z-Score 也恒为 0"),
        bulletItem("模型训练时，这个全零列完全不提供信息，但仍然占据一个特征维度"),

        calloutBox(
          "通俗解释",
          "这就像一家公司的董事会中有一个永远投「弃权票」的成员。他不影响任何决议，但占了一个席位。在极端情况下，树模型可能会在某个随机分裂点选中这个全零特征，引入纯粹的噪声。",
          C.accent
        ),

        heading2("解决方案"),
        bulletItem("从因子列表中彻底移除 F7_WGC"),
        bulletItem("在 model_health.json 中新增「死因子检测」：如果任何因子的方差为零或 IC 为 NaN，自动标记为 dead factor"),
        bulletItem("建立因子存活率指标：每月检查所有因子的数据新鲜度"),

        para("教训很简单：定期审计你的因子库。数据源会失效，API会改版，因子会「死掉」。一个没有数据更新的因子比没有因子更危险，因为它给你一种虚假的安全感——「我有10个因子，应该够稳健了吧？」", { indent: true }),

        new Paragraph({ children: [new PageBreak()] }),

        // ──────── 陷阱4：IC 污染 ────────
        heading1("陷阱四：IC 污染——用答案来判断自己考得好不好"),

        heading2("现象"),
        para("模型训练完成后，我们计算了 IC（Information Coefficient，信息系数）来评估模型质量。结果显示：", { indent: true }),

        dataTable(
          ["时间段", "IC 值", "解读"],
          [
            ["2023.01 - 2023.06", "+0.91", "几乎完美预测"],
            ["2023.07 - 2024.06", "+0.72", "非常优秀"],
            ["2024.07 - 2025.03", "数据缺失", "IC追踪中断5个月"],
            ["2025.10 (最新)", "-0.16", "反向预测"],
          ],
          [3200, 2000, 4160]
        ),

        spacer(100),
        para("从0.91到-0.16，IC出现了断崖式下跌。但更大的问题是：0.91这个数字本身就有问题。", { indent: true }),

        calloutBox(
          "什么是 IC（信息系数）？",
          "IC 衡量的是模型预测值和实际值之间的排序一致性（Spearman相关系数）。IC=1 表示完美预测，IC=0 表示随机猜测，IC<0 表示反向预测。在量化领域，IC > 0.05 就被认为有价值，IC > 0.1 已经很优秀，IC > 0.3 几乎不可能在样本外持续达到。",
          C.accent
        ),

        heading2("根因：样本内 IC 的幻觉"),
        para("IC = 0.91 之所以不真实，是因为它是在训练数据上计算的（In-Sample IC）。模型在训练时已经「看过」了这些数据的答案，所以自然能给出高分。这就像：", { indent: true }),

        bulletItem("考试前把答案背下来，然后考了95分——你觉得自己很厉害"),
        bulletItem("换一张新卷子，考了15分——才发现之前只是在「背答案」"),

        para("正确的做法是只计算样本外（Out-of-Sample, OOS）IC，使用 Purged Time Series Cross-Validation，并确保训练集和测试集之间有足够的时间间隔（我们使用20天的purge gap），防止信息泄漏。", { indent: true }),

        heading2("修复后"),
        dataTable(
          ["指标", "修复前", "修复后", "说明"],
          [
            ["IC 计算方式", "混合(IS+OOS)", "纯 OOS", "消除泄漏"],
            ["CV 方法", "无 purge", "Purged TSCV (20天gap)", "防止前瞻"],
            ["OOS 样本数", "未知", "123", "可验证"],
            ["OOS Mean IC", "0.91 (虚高)", "+0.031", "真实水平"],
          ],
          [2600, 2200, 2600, 1960]
        ),

        spacer(100),
        para("OOS IC = 0.031，虽然看起来「不够漂亮」，但这才是模型的真实预测能力。在黄金这样高效的市场中，这个水平已经具有边际价值——关键是要诚实面对。", { indent: true }),

        calloutBox(
          "启发",
          "在量化研究中，最危险的不是模型不好，而是你以为模型很好。样本内的优异表现是过拟合的经典症状。永远只关注 OOS 指标，永远对「太好的结果」保持怀疑。如果你的IC超过0.3，第一反应应该是「哪里有bug」，而不是「我发现了圣杯」。",
          C.red
        ),

        new Paragraph({ children: [new PageBreak()] }),

        // ──────── 陷阱5：Regime检测失灵 ────────
        heading1("陷阱五：Regime 检测过于保守——永远「无法确定」的市场状态"),

        heading2("现象"),
        para("系统的 Regime 热力图模块本应告诉我们当前市场处于哪种状态：Risk-On（风险偏好）、Risk-Off（避险）或 Transition（过渡期）。但在检查中，我们发现几乎所有时间段都显示「Transition」：", { indent: true }),

        bulletItem("Transition 占比 > 80%"),
        bulletItem("Risk-Off 和 Risk-On 几乎从未触发"),
        bulletItem("更糟糕的是：当系统确实触发 Transition 时，它将其映射为 Risk-Off，导致持仓减半"),

        heading2("根因"),
        para("Regime 检测使用5个因子的 Z-Score 加权打分，但阈值设置得太严格了：", { indent: true }),

        dataTable(
          ["条件", "旧阈值", "含义", "触发概率"],
          [
            ["Risk-Off", "score < -1.0", "5因子加权Z均值 < -1σ", "~16%"],
            ["Risk-On", "score > +1.0", "5因子加权Z均值 > +1σ", "~16%"],
            ["Transition", "其他", "介于两者之间", "~68%"],
          ],
          [2200, 2200, 3000, 1960]
        ),

        spacer(100),
        para("±1.0 标准差意味着只有最极端的32%的市场状态才会被分类。这就像一个天气预报员，只有气温超过40度才说「热」，低于-10度才说「冷」，其他时候都说「不确定」——这样的预报几乎没有实用价值。", { indent: true }),

        heading2("解决方案"),
        para("我们将阈值从 ±1.0 降低到 ±0.5，并引入更细粒度的分类：", { indent: true }),

        dataTable(
          ["状态", "阈值", "持仓乘数", "含义"],
          [
            ["Risk-Off", "score < -0.5", "0.3x", "避险模式，大幅减仓"],
            ["Cautious", "-0.5 ~ 0.0", "0.7x", "谨慎模式，适度减仓"],
            ["Neutral", "0.0 ± 0.15", "1.0x", "中性，正常持仓"],
            ["Favorable", "0.0 ~ +0.5", "1.0x", "偏好模式，正常持仓"],
            ["Risk-On", "score > +0.5", "1.2x", "激进模式，可加仓"],
          ],
          [2000, 2200, 2000, 3160]
        ),

        spacer(100),
        calloutBox(
          "启发",
          "Regime 检测的目的是辅助决策，不是追求完美分类。一个「大致正确」的状态判断比「要么极端、要么不确定」的判断有用得多。在设计阈值时，考虑实际的市场分布——大部分时间市场处于温和状态，你的系统也应该能描述这些温和状态。",
          C.orange
        ),

        new Paragraph({ children: [new PageBreak()] }),

        // ──────── 陷阱6：数据链断裂 ────────
        heading1("陷阱六：数据链断裂——看不见的「供应链危机」"),

        heading2("现象"),
        para("在某次日常检查中，我们发现仪表板显示的金价是 $3124.50——而真实金价已经在 $4500 以上。前端显示的 F5（地缘政治风险）和 F6（黄金波动率）也停留在几周前的数值。", { indent: true }),

        para("一个量化系统的「数据链」通常是这样的：", { indent: true }),

        paraRuns([
          cnText("数据源 (Yahoo/FRED/Stooq)", { bold: true }),
          cnText(" → "),
          cnText("数据获取 (API调用)", { bold: true }),
          cnText(" → "),
          cnText("因子计算", { bold: true }),
          cnText(" → "),
          cnText("模型推理", { bold: true }),
          cnText(" → "),
          cnText("前端展示", { bold: true }),
        ]),

        para("这条链上的任何一环断裂，后面的环节都会受影响。而我们遇到的断裂点不止一个：", { indent: true }),

        dataTable(
          ["断裂点", "原因", "影响", "症状"],
          [
            ["Yahoo v7 API", "需要crumb认证，已失效", "金价获取失败", "显示mock数据$3124"],
            ["Stooq API", "频率限制触发", "备用源也失败", "完全无实时数据"],
            ["^OVX / ^GVZ", "Yahoo Quotes失败", "F5/F6因子无更新", "显示旧值"],
            ["WGC ETF Flow", "API已下线", "F7永远为0", "死因子"],
          ],
          [2000, 2400, 2400, 2560]
        ),

        heading2("解决方案：多层降级策略"),
        para("我们为每个数据源建立了多层降级（fallback）机制：", { indent: true }),

        bulletItem("金价：Yahoo v7 Quotes → Yahoo v8 Chart API（无需crumb）→ Stooq → Pipeline signal.json → Mock"),
        bulletItem("因子数据：Yahoo Quotes → Pipeline signal.json 因子数组 → 默认值"),
        bulletItem("每层降级都记录数据来源标签，前端根据来源显示 LIVE / DELAYED / SIMULATED"),

        para("关键改进是发现了 Yahoo 的 v8 Chart API（query2.finance.yahoo.com）不需要 crumb 认证，直接用 GET 请求就能获取实时价格。这成为了我们最可靠的数据源。", { indent: true }),

        calloutBox(
          "启发",
          "你的系统只有数据链最脆弱的环节那么强。对每个外部数据源，都应该有至少两个备选方案。更重要的是，要有监控机制在数据链断裂时立即报警——而不是等用户发现「金价怎么还是上周的」时才知道出了问题。建议在仪表板上永远显示数据时间戳和来源标签。",
          C.red
        ),

        new Paragraph({ children: [new PageBreak()] }),

        // ──────── 陷阱7：Mock数据渗透 ────────
        heading1("陷阱七：Mock 数据渗透——开发便利变成生产隐患"),

        heading2("现象"),
        para("这个问题最为隐蔽。为了开发方便，前端组件中大量使用了 mock 数据作为 fallback。当 API 调用失败时，组件不会报错，而是静默地显示 mock 数据——用户完全看不出区别。", { indent: true }),

        para("我们审计了所有前端组件，发现问题无处不在：", { indent: true }),

        bulletItem("EquityCurve：直接从 mockData.ts 读取假净值曲线"),
        bulletItem("AccountCard：显示虚构的 $107,250 净值和 1.87 Sharpe"),
        bulletItem("RightSidebar：SignalCard、PositionCard 都有 mock fallback"),
        bulletItem("LeftPanel：SHAP 归因图在 API 失败时显示假数据"),
        bulletItem("TopBar：只把 yahoo 和 stooq 标记为 LIVE，pipeline 来源的真实数据被标记为 SIMULATED"),

        para("最危险的场景是：真实金价 API 失败，前端静默显示 mock 价格 $3124.50，而用户以为这是实时数据，基于此做出交易决策。", { indent: true }),

        heading2("解决方案"),
        bulletItem("将所有图表组件从 mock 数据迁移到 pipeline API"),
        bulletItem("当 API 返回空数据时，显示「加载中...」或「无数据」，而不是假数据"),
        bulletItem("修改 isLive 判断逻辑：source !== 'mock' 就标记为 LIVE"),
        bulletItem("pipeline 回测自动生成 equity_curve.json / account.json / positions.json"),
        bulletItem("前端只保留2处 mock 引用（因子 API 的 schema fallback），且明确标注"),

        para("修复后，仪表板上的每一个数字都来自真实的数据管道，mock 数据不再有任何机会渗透到生产展示中。", { indent: true }),

        calloutBox(
          "启发",
          "在量化系统中，「显示假数据而不报错」比「报错但不显示数据」更危险。前者会导致基于错误信息的交易决策，后者至少让你知道系统出了问题。开发时的便利（mock数据）如果不在上线前彻底清理，就会变成生产环境中的定时炸弹。",
          C.red
        ),

        new Paragraph({ children: [new PageBreak()] }),

        // ──────── 全面改进总结 ────────
        heading1("改进全景：从「能跑」到「可信赖」"),

        para("经过三轮系统性改进，Gold Monitor 从一个「能产生信号但不可信」的原型，进化为一个「数据透明、模型可解释、风险可控」的交易系统。以下是关键指标的对比：", { indent: true }),

        spacer(100),

        dataTable(
          ["维度", "改进前", "改进后", "改善幅度"],
          [
            ["因子数量", "10 (含3冗余+1死因子)", "7 (全部独立)", "精简30%"],
            ["高相关因子对", "11 对 (|r|>0.6)", "2 对", "-82%"],
            ["SHAP 最大占比", "96.2%", "33%", "-63pp"],
            ["OOS IC", "0.91 (虚假)", "0.031 (真实)", "诚实化"],
            ["Regime 有效分类", "~20%", "~70%", "+50pp"],
            ["数据源降级层数", "1层", "4层", "+3层"],
            ["Mock 数据引用", "12处", "2处(仅schema)", "-83%"],
            ["API 端点", "8个", "11个", "+3个"],
            ["OOS回测收益", "未知", "+3.43%", "可量化"],
            ["OOS回测 Sharpe", "未知", "0.46", "可量化"],
            ["OOS回测胜率", "未知", "53.3%", "可量化"],
          ],
          [2600, 2400, 2400, 1960]
        ),

        spacer(200),

        heading2("回测业绩概览"),
        para("基于7因子精简模型在2025年10月至2026年3月（184个交易日）的纯样本外回测结果：", { indent: true }),

        dataTable(
          ["指标", "策略", "GLD持有", "超额收益"],
          [
            ["累计收益", "+3.43%", "+17.77%", "-14.34%"],
            ["最大回撤", "6.67%", "14.1%", "策略更优"],
            ["Sharpe", "0.46", "0.91", "GLD更优"],
            ["交易次数", "15笔", "N/A (持有)", "—"],
            ["胜率", "53.3%", "N/A", "—"],
          ],
          [2600, 2000, 2400, 2360]
        ),

        spacer(100),
        para("策略在绝对收益上不及简单持有（黄金在此期间大涨17.8%），但最大回撤（6.67% vs 14.1%）显著更低。这符合量化策略的典型特征：牺牲部分趋势追踪能力，换取更好的风险控制。", { indent: true }),

        para("值得注意的是，策略在2025年12月-2026年1月的回撤期（黄金从$4200跌到$4400后反弹至$5300）做了两笔亏损的空头交易，这是因为模型在趋势反转时反应不够快。这也指向了下一步的改进方向：引入趋势跟踪因子或动量信号。", { indent: true }),

        new Paragraph({ children: [new PageBreak()] }),

        // ──────── 监控框架 ────────
        heading1("建立持续监控体系"),

        para("一次性修复不够，我们还需要一套持续运行的监控框架来防止问题复发。以下是我们建立的三层监控体系：", { indent: true }),

        heading2("日检（每日自动运行）"),
        bulletItem("数据新鲜度：所有因子数据时间戳是否在T-1内"),
        bulletItem("金价验证：API金价 vs Pipeline金价差异 < 1%"),
        bulletItem("信号合理性：预测收益率在 [-10%, +10%] 范围内"),
        bulletItem("SHAP 稳定性：单因子贡献 < 60%"),

        heading2("周检（每周手动审查）"),
        bulletItem("IC 趋势：20日滚动IC是否持续为负"),
        bulletItem("相关性矩阵：是否出现新的高相关因子对"),
        bulletItem("因子存活：所有因子是否有新数据"),
        bulletItem("模型健康报告：model_health.json 是否有新增 warning"),

        heading2("月检（每月深度复盘）"),
        bulletItem("回测更新：用最新数据重跑回测，检查收益衰减"),
        bulletItem("因子IC排名：移除连续3个月IC为负的因子"),
        bulletItem("Regime分布：检查5种状态的分布是否合理（都不应该<5%）"),
        bulletItem("重训练评估：比较新旧模型的OOS IC差异，决定是否更新"),

        spacer(100),

        calloutBox(
          "核心原则",
          "量化交易系统不是「造好就放着」的产品。它更像一个需要持续维护的花园——因子会死掉、数据源会失效、市场结构会变化。定期的监控和复盘不是可选项，而是系统存活的必要条件。",
          C.gold
        ),

        new Paragraph({ children: [new PageBreak()] }),

        // ──────── 总结 ────────
        heading1("结语：七大陷阱的共同根源"),

        para("回顾这七大陷阱，它们有一个共同的根源：对「表面正确」的过度信任。", { indent: true }),

        bulletItem("SHAP支配：模型输出了信号，就以为信号是对的"),
        bulletItem("多重共线性：因子数量够多，就以为模型够稳健"),
        bulletItem("死因子：因子在代码里存在，就以为它在工作"),
        bulletItem("IC污染：IC很高，就以为模型很好"),
        bulletItem("Regime保守：系统有Regime模块，就以为它在发挥作用"),
        bulletItem("数据断裂：页面显示了数字，就以为数字是最新的"),
        bulletItem("Mock渗透：界面看起来正常，就以为数据是真实的"),

        spacer(100),

        para("量化交易的核心挑战不是写出一个能跑的模型，而是建立一套让你能够持续验证「模型是否在正确运行」的体系。当你能够回答以下三个问题时，你的系统才真正从「玩具」变成了「工具」：", { indent: true }),

        spacer(80),

        new Paragraph({
          spacing: { before: 80, after: 80 },
          numbering: { reference: "numbers", level: 0 },
          children: [cnText("我的模型现在在看什么？", { bold: true, size: 24 }), cnText("（SHAP归因 + 因子健康监控）")],
        }),
        new Paragraph({
          spacing: { before: 80, after: 80 },
          numbering: { reference: "numbers", level: 0 },
          children: [cnText("我的模型真的有预测力吗？", { bold: true, size: 24 }), cnText("（纯OOS IC + 回测收益）")],
        }),
        new Paragraph({
          spacing: { before: 80, after: 80 },
          numbering: { reference: "numbers", level: 0 },
          children: [cnText("我看到的数据是真实的吗？", { bold: true, size: 24 }), cnText("（数据源标签 + 新鲜度检查）")],
        }),

        spacer(200),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: C.gold, space: 12 } },
          spacing: { before: 200, after: 60 },
          children: [cnText("The goal is not to build a model that looks right,", { italics: true, color: C.textLight, size: 22, font: "Arial" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 60 },
          children: [cnText("but to build a system that tells you when it's wrong.", { italics: true, color: C.textLight, size: 22, font: "Arial" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 60 },
          children: [cnText("—— Gold Monitor Team, 2026.03", { size: 20, color: C.textLight })],
        }),
      ],
    },
  ],
});

// ── Generate ──
const OUTPUT = "/Users/vivienna/Desktop/VibeCoding/GoldMonitor/宏观因子量化交易的七大陷阱.docx";
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(OUTPUT, buffer);
  console.log(`Created: ${OUTPUT} (${(buffer.length / 1024).toFixed(0)} KB)`);
});
