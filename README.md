# Traffic Lane Defender

左右來車防撞遊戲。管理三條車道，拖曳車輛上下換道，避免左右來車相撞。

## 遊玩方式

- 手機：按住車子，向上或向下滑動切換相鄰車道。
- 電腦：用滑鼠拖曳車子上下換道。
- 鍵盤：先點選車子，再用 `↑` / `↓` 或 `W` / `S` 換道。
- `Tab` 可切換選取車輛，`F` 可切換全螢幕。
- 遊戲中可按右上角「結束」主動停止本局並查看分數。
- 開始選單可按「測試車種音效」依序播放 10 種車聲，先確認瀏覽器音訊輸出。
- 所有車子安全通過畫面另一端即可得分。

## 特色

- 邊緣紅色預警提示即將來車方向與車道。
- 實際位置碰撞判定，換道動畫與判定更一致。
- 階段式難度曲線，速度與車流量會隨分數逐步提升。
- 最高分、Combo 倍率與擦身獎勵會即時累積。
- 響應式大畫面配置，桌機與手機都會盡量放大遊戲區。
- AI 產生的透明車輛 sprite sheet，包含 10 種車、4 幀行駛動畫與 GIF 預覽。
- 安全生成器會預測對向車碰撞時間、限制同時危機數，並確認至少有一條可用逃生車道。
- 車輛首次進入畫面時會播放對應車種的 WAV 音效，如小客車 `vroom vroom`、計程車 `beep beep`、公車低音喇叭與工程車柴油/機械聲。

## 車輛素材

- 遊戲使用：`assets/cars/vehicle-sprites.png`
- 素材資訊：`assets/cars/vehicle-sprites.json`
- 動圖預覽：`assets/cars/vehicle-preview.gif`
- 工程車種類：砂石車、水泥攪拌車、拖吊車、壓路機、吊車
- 車種音效：`assets/sounds/*.wav`
- 音效產生腳本：`scripts/generate_vehicle_sounds.js`

## 部署

這是純 HTML / CSS / JavaScript 靜態網站，可直接部署到 GitHub Pages。

GitHub Pages 建議設定：

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`
