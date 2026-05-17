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
- 車輛首次進入畫面時會播放對應車種的 2 秒 WAV 音效，已改用 Mixkit 真實錄音片段重新配對。
- 遊戲開始後會循環播放背景音樂，並會跟右上角聲音開關連動。

## 車輛素材

- 遊戲使用：`assets/cars/vehicle-sprites.png`
- 素材資訊：`assets/cars/vehicle-sprites.json`
- 動圖預覽：`assets/cars/vehicle-preview.gif`
- 工程車種類：砂石車、水泥攪拌車、拖吊車、壓路機、吊車
- 車種音效：`assets/sounds/*.wav`（依車種配對 Mixkit 真實錄音）
- 音效來源紀錄：`assets/sounds/vehicle-sounds-credits.json`
- 合成備援腳本：`scripts/generate_vehicle_sounds.js`
- 背景音樂：`assets/music/toy-car-battle.mp3`

## 部署

這是純 HTML / CSS / JavaScript 靜態網站，可直接部署到 GitHub Pages。

GitHub Pages 建議設定：

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

## Audio Controls

- Use the `音量` button to adjust game sound effects and background music separately.
- Volume settings are saved in the browser and reused the next time the game opens.
- Background music uses a 30-second crossfade between the end of the track and the next loop for smoother continuous playback.

## Route Variety

- Each run cycles through a different road layout, including 2, 3, 4, and 5 lane routes.
- Cars can move from the outside lane onto the roadside shoulder to park and avoid danger, then swipe back toward the road to rejoin traffic.
- Touch dragging is limited to one lane/shoulder move per swipe, so one flick cannot jump across multiple lanes.
- The background rotates through five city styles while the run continues.

## Road Obstacles

- The road-obstacle challenge can be enabled from the start menu before beginning a run.
- Moving vehicles can drop banana peels, trash bags, road barrier barrels, and speed-up oil slicks.
- Click or tap an obstacle quickly to clear it before traffic reaches it; cleared obstacles award a small point bonus.
- If left uncleared, banana peels force a lane change, trash bags slow a vehicle, oil slicks speed a vehicle up, and road barrier barrels still end the run with a crash.

## PWA

This project is configured as an installable Progressive Web App.

- `manifest.webmanifest` defines the app name, standalone display mode, theme color, and icons.
- `service-worker.js` precaches the game shell, vehicle images, sound effects, background music, and manifest/icons for offline play.
- Open it from GitHub Pages or a local HTTP server, then use the browser's install option to add it to the device.
