# dsh-wsl-media

> **语言：** **中文**（本页） · [English](./README.en.md)

WSL 本地媒体工具：**ffprobe**、**pdftotext**、可选 **whisper** ASR。

不在 `install.sh`。路径必须在白名单根下（默认：家目录、`~/.dsh`、`/tmp`、`/mnt/c|d`）。

## 最短上手

```sh
# 依赖示例（Debian/Ubuntu）
sudo apt install ffmpeg poppler-utils   # ffprobe / pdftotext
# whisper：自行装到 PATH（可选）

dsh plugin --profile web add github:173787247/dsh-wsl-media
```

## 工具

| 工具 | 作用 |
|------|------|
| `media_status` | 各二进制是否在 PATH |
| `media_probe` | ffprobe 元数据 |
| `media_pdf_text` | PDF 抽文本（有长度上限） |
| `media_asr` | 语音转写（需 whisper） |

## 配置

```yaml
config:
  enabled: true
  timeoutMs: 120000
  maxPdfChars: 100000
  allowRoots: []           # 空 = 用默认根；可追加绝对路径
```

Windows 盘符路径经 `/mnt/c/...` 访问；勿把任意盘根放进 allowlist。

## License

MIT
