#!/usr/bin/env python3
"""Generate 8 tab bar icons for the miniprogram."""

from PIL import Image, ImageDraw

SIZE = 81
GRAY = "#6B7280"
GOLD = "#F59E0B"
OUT = "/Users/vivienna/Desktop/VibeCoding/GoldMonitor/miniprogram/images"


def draw_dashboard(draw, color):
    """4-square grid icon."""
    s = SIZE
    pad = 16
    gap = 6
    w = (s - 2 * pad - gap) // 2  # width of each square

    for r in range(2):
        for c in range(2):
            x0 = pad + c * (w + gap)
            y0 = pad + r * (w + gap)
            x1 = x0 + w
            y1 = y0 + w
            # rounded rectangles
            draw.rounded_rectangle([x0, y0, x1, y1], radius=4, fill=color)


def draw_factors(draw, color):
    """Bar chart icon - 3 bars of different heights."""
    s = SIZE
    pad = 16
    bar_w = 12
    gap = 7
    total_w = 3 * bar_w + 2 * gap
    x_start = (s - total_w) // 2
    bottom = s - pad

    heights = [28, 42, 34]
    for i, h in enumerate(heights):
        x0 = x_start + i * (bar_w + gap)
        y0 = bottom - h
        x1 = x0 + bar_w
        y1 = bottom
        draw.rounded_rectangle([x0, y0, x1, y1], radius=3, fill=color)


def draw_chart(draw, color):
    """Line chart / trending icon - polyline going up."""
    s = SIZE
    pad = 18
    lw = 4

    # Draw a trending-up polyline
    points = [
        (pad, s - pad - 5),
        (pad + 14, s - pad - 20),
        (pad + 28, s - pad - 10),
        (s - pad, pad + 5),
    ]
    draw.line(points, fill=color, width=lw, joint="curve")

    # Arrow head at the end
    ex, ey = points[-1]
    draw.polygon(
        [(ex, ey), (ex - 10, ey + 4), (ex - 6, ey + 10)],
        fill=color,
    )

    # Base line
    draw.line(
        [(pad - 2, s - pad + 2), (s - pad + 2, s - pad + 2)],
        fill=color,
        width=3,
    )
    # Y-axis line
    draw.line(
        [(pad - 2, pad - 2), (pad - 2, s - pad + 2)],
        fill=color,
        width=3,
    )


def draw_account(draw, color):
    """User/person icon - circle head + body arc."""
    s = SIZE
    cx = s // 2
    lw = 4

    # Head circle
    hr = 12
    head_cy = 26
    draw.ellipse(
        [cx - hr, head_cy - hr, cx + hr, head_cy + hr],
        fill=color,
    )

    # Body / shoulders arc
    body_top = head_cy + hr + 6
    body_w = 22
    draw.arc(
        [cx - body_w, body_top - 4, cx + body_w, body_top + 36],
        start=200,
        end=340,
        fill=color,
        width=lw + 1,
    )
    # Fill the body with a rounded shape
    draw.chord(
        [cx - body_w, body_top, cx + body_w, body_top + 38],
        start=180,
        end=360,
        fill=color,
    )


ICONS = {
    "dashboard": draw_dashboard,
    "factors": draw_factors,
    "chart": draw_chart,
    "account": draw_account,
}

for name, draw_fn in ICONS.items():
    for active in (False, True):
        img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        color = GOLD if active else GRAY
        draw_fn(draw, color)
        suffix = "-active" if active else ""
        filename = f"{OUT}/icon-{name}{suffix}.png"
        img.save(filename)
        print(f"Created: {filename}")

print("\nDone! All 8 icons generated.")
