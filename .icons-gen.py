"""临时脚本：生成小程序 tabBar 图标（81x81 PNG，透明底线条图标）"""
import os
from PIL import Image, ImageDraw

N = 81          # 输出尺寸
S = 6           # 超采样倍数
W = N * S
G = W / 24.0    # 以 24x24 设计栅格换算
LW = round(1.65 * G)   # 线宽

OUT = '/workspace/weapp/miniprogram/images/tab'
NORMAL = (107, 103, 96, 255)     # #6b6760
ACTIVE = (231, 210, 164, 255)    # #e7d2a4


def P(v):
    return v * G


def new_canvas():
    img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def draw_home(d, c):
    d.rounded_rectangle([P(3), P(4), P(21), P(20)], radius=P(3), outline=c, width=LW)
    d.polygon([(P(10), P(9.1)), (P(15.4), P(12)), (P(10), P(14.9))], fill=c)


def draw_grid(d, c):
    for x, y in ((3.5, 3.5), (13.5, 3.5), (3.5, 13.5), (13.5, 13.5)):
        d.rounded_rectangle([P(x), P(y), P(x + 7), P(y + 7)], radius=P(1.6), outline=c, width=LW)


def draw_tag(d, c):
    d.line([(P(11.2), P(4.2)), (P(5.2), P(4.2)), (P(4.2), P(5.2)), (P(4.2), P(11.2)),
            (P(12.9), P(19.9)), (P(19.9), P(12.9)), (P(11.2), P(4.2))],
           fill=c, width=LW, joint='curve')
    r = P(1.5)
    d.ellipse([P(8.4) - r, P(8.4) - r, P(8.4) + r, P(8.4) + r], fill=c)


def draw_vote(d, c):
    d.rounded_rectangle([P(4), P(3), P(20), P(21)], radius=P(2.6), outline=c, width=LW)
    d.line([(P(8.4), P(12.1)), (P(10.9), P(14.6)), (P(15.8), P(9.4))],
           fill=c, width=LW, joint='curve')


def draw_mine(d, c):
    r = P(3.7)
    d.ellipse([P(12) - r, P(8) - r, P(12) + r, P(8) + r], outline=c, width=LW)
    d.arc([P(4.2), P(12.4), P(19.8), P(26.6)], start=200, end=340, fill=c, width=LW)


ICONS = {
    'home': draw_home,
    'grid': draw_grid,
    'tag': draw_tag,
    'vote': draw_vote,
    'mine': draw_mine,
}

os.makedirs(OUT, exist_ok=True)

for name, fn in ICONS.items():
    for suffix, color in (('', NORMAL), ('-on', ACTIVE)):
        img, d = new_canvas()
        fn(d, color)
        img = img.resize((N, N), Image.LANCZOS)
        path = os.path.join(OUT, name + suffix + '.png')
        img.save(path, 'PNG')
        print('wrote', path, os.path.getsize(path), 'bytes')