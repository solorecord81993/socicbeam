# SonicBeam Lab 0.7

Browser-local acoustic link exploration. No server data path, no uploaded microphone recordings, no dependencies. Static entry: dist/index.html.

## Test flow
Open the HTTPS Vercel site on two devices. Permit microphone in Safari/Chrome. Disable Bluetooth, keep foreground. Mark A transmitter, B receiver. Match frequency range, manually record source system volume and gain on receiver. At B start recording; wait 2-second ambient reference, then sweep at A. Stop recording B after sweep. Repeat at other gain/system-volume settings, same geometry. Swap roles to characterize the reverse path. Export/import JSON to combine results.

The receiver estimates per-frequency signal relative to the 2-second ambient median FFT reference. A source sweep uses 250 Hz spacing, 0.7-second tone, 0.25-second silence, and 15 ms ramps. It records the median of the strongest eight observed frames per target frequency; this is a practical scan summary, not calibrated SPL or a guaranteed capacity estimate. Continuous runs of >=4 bins at >=10 dB above ambient and >-100 FFT dBFS suggest candidate bands. External interference can contaminate estimates. Repeat with the source off as a control. Results describe the whole directional link, not isolated loudspeaker/microphone response. Sample rate determines Nyquist guard; hardware filtering can impose a lower limit.

## Acoustic protocol
Baseline noncoherent 4-FSK, 4 tones at band quartile centers, selectable 10/20/40/80 ms symbols (200/100/50/25 raw bit/s). All settings manually match. Preamble: alternating 0/3 (16 symbols) plus 8-symbol sync. Header: type, 16-bit random session, sequence, length. Up to 96 payload bytes and CRC16-CCITT-FALSE. AudioWorklet receiver correlates four Hann-windowed tones, searches preamble timing, then checks CRC. Transmit suppresses own receive decoder; microphones are never looped into audible output.

Half-duplex stop-and-wait, ACK contains packet type and CRC plus same session/seq. 420 ms receiver turnaround, 220 ms local transmit tail, 400 ms sender post-ACK guard; maximum three attempts total. Type 1 benchmark, 2 ACK, 3 transfer metadata, 4 data, 5 finish. Metadata carries size and SHA-256; payload chunks are 32 bytes. Finish is ACKed only after complete SHA-256 verification. Retry duplicates are ACKed without duplicate processing. Files capped at 4096 bytes; receiver uses a safe generated filename. No encryption or identity authentication.

Benchmark goodput = acoustically ACKed unique CRC-valid payload bytes * 8 / full wall-clock run including all attempts and guards. File goodput is zero unless final SHA-256 confirmation arrives; otherwise whole file bytes / full transfer duration. Do not compare this to raw rate or infer Shannon capacity from FFT SNR. Best observed rate requires multiple physical repeated tests; no claim of maximum hardware capability.

## Validation
`npm test` runs modem and protocol checks. `node tests.mjs` verifies CRC reference vector, 44.1/48 kHz decoding, all selectable symbol rates, noise, unaligned starts, slight clock mismatch, max payload, corrupt-frame rejection, silence. `node protocol-test.mjs` additionally checks a dropped ACK/retry, duplicate handling, benchmark accounting and complete metadata/chunk/SHA-256 transfer across two application instances with synthesized audio. These are synthetic tests, not a two-phone end-to-end performance claim. No managed browser QA capability was available during creation. Real iOS/Android permission handling, audio routing, received levels, and reliable acoustic throughput need physical device validation. Backgrounding stops audio; wake lock is best effort.

## Next experiments
Gather directional results and goodput at matched range/rate settings, three repeats per condition. Then select a control band proven both ways; add negotiated rates, FEC, interleaving, timing tracking and OFDM only if evidence supports higher net throughput. A high-frequency output can create audible artifacts; ultrasound audibility and sound pressure are not certified by this app. Start at low physical volume without headphones and stop if uncomfortable.

References: https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings ; https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API/Constraints ; https://www.mdpi.com/1424-8220/22/19/7345

## Vercel deployment

GitHub repository: `solorecord81993/socicbeam`. Vercel project: `socicbeem` (team `saijai1`). These names intentionally match the supplied project URLs. `vercel.json` explicitly selects static hosting and the `dist` output directory. `npm run build` validates JavaScript and all shipped assets; no framework or runtime dependencies are required. Production deploys follow pushes to `main` through the configured Git integration.

## Goodput-frequency survey

The survey plots X = test-band midpoint (kHz), Y = mean verified payload goodput (bit/s). Each window is 750/1000 Hz wide, moving 250/500 Hz; the last window covers the upper edge. The default scan is 20 kHz to min(23 kHz, both peers Nyquist minus 200 Hz), rounded down to 250 Hz. 18 kHz needs explicit audible-band consent on both peers. Two 32-byte packets per round; 1 or 3 rounds per window. Error bars show observed min/max (not confidence intervals). Unmeasured windows are null; failed measured rounds are 0. Results retain direction, distance, gain, manually entered sender volume and raw bit rate.

The existing control band must support bidirectional ACK before scan. Type 8 queries peer sample rate and accepted minimum frequency. ACK adds sample rate and permitted minimum. Type 6 negotiates a temporary band and finite lease over control audio; peers then switch after ACK. Type 7 finishes the lease, acknowledges at the test band, and returns to control. Receiver lease timeout restores control after loss; sender waits out the lease when finish is unconfirmed. Scan goodput includes payload framing/ACK/retry time, but excludes per-window control setup/return. The modulation speed remains fixed across a survey; rerun at other speeds/gains for comparison. No maximum achievable capacity is claimed.

`protocol-test.mjs` now also exercises a complete five-window scan with configuration-aware acoustic decoding, both-peer retuning, return-to-control and null-vs-zero distinction. Its timers are accelerated for synthetic protocol validation only; application timers and measured goodput are real wall-clock values.

## Simple two-device interface

The home screen has a Receive / Send segmented control and one primary action. Receiver: select Receive and press Start receiving once to open the microphone and wait. Sender: select Send and press Start test once to open audio, negotiate with the receiver and run the complete survey. Both quick actions normalize the control band to 20–21 kHz and 40 ms symbols, compatible with 44.1/48 kHz sampling. Gain and survey options remain adjustable inside collapsed advanced tools. Graphs appear on the sender; receiver status explains the next action.

Microphone refusal and absent-peer failures appear inline with a retry button. Opening audio locks both role selectors and the primary action; the primary button switches to Stop receiving or Stop sending while active. Stop resets the visible flow. A completion message (type 8, one-byte payload 1, sequence 255) tells the receiver when the whole survey is finished. Detailed metadata, spectrum tools, manual controls and transfers remain available under the advanced disclosure.

The protocol harness additionally verifies one-click receiver setup, one-click sender survey, completion feedback at both devices, microphone denial and absent-peer retry. Physical phone audio performance still needs device testing.

## Reference UI refresh (0.4)

The mobile layout follows the supplied SonicBeam mockup: a warm white background, centered waveform wordmark, a large teal start button with role-specific SVG icon, a receiver phone-placement illustration, and a sender goodput-by-frequency card. All built-in interface labels and runtime messages are English. Detailed controls stay inside Advanced settings. Stop appears while audio is opening or active. Empty charts show axes without simulated data; measured goodput retains the same acoustic protocol and statistics. The layout uses a 480 px maximum width and adapts to small phone screens.

The main button toggles start/stop for both roles. Stopping cancels the active audio source, ACK wait and microphone session. While an asynchronous operation finishes cancelling, Stopping… prevents overlapping restarts; then the same button is ready to start again. Completed measurements remain available.

## Reception diagnostics (0.5)

After starting Receive, the placement guide becomes a live Received data card: last CRC-valid packet type/sequence/length, valid packet count, unique accepted payload bytes, locally played ACK count, ACK queue/play/error status, microphone input level, and current-band FFT peak. Completed text/file content is also visible here. ACK played confirms local playback only; compare the sender ACK_MATCHED event to verify the return path.

Diagnostics is available on both roles with Copy log, Download log and Clear. It logs decoder preambles and CRC/length failures, ignored/duplicate packets, ACK attempts/playback errors, sender retries/timeouts and matching, sample rate, requested/current band, microphone processing settings and audio lifecycle errors. The worklet emits microphone telemetry once a second; logs retain the latest 250 events locally and display the latest 80. Exports include both current counters and timestamped events with page-session identifiers. No raw audio or message/file contents are stored in diagnostic events. Physical two-device failures still require comparing both devices’ reports.

## Compact control, receive rate and completion (0.6)

New peers advertise compact-control support in the ACK. The 49-byte JSON band command becomes a 10-byte binary record (marker, low/high frequency, symbol duration, lease milliseconds). Receivers still accept older JSON commands. Upgraded control requests explicitly ask for two CRC-protected ACK copies. The sender stays on its current band through the copy window; the receiver retunes only after both copies play. Payload ACKs remain single-copy. If a local ACK playback fails, a duplicate command can retry the pending transition. A missing control ACK still uses a conservative lease recovery wait before aborting; this is not a guarantee against all acoustic losses.

Survey payload rates are selectable at 25/50/100/200 raw bit/s, default 100, while quick-start control remains 50 bit/s. The rate is negotiated in the command, so the receiver needs no matching manual speed selection. Older peers use the existing control bitrate for the survey. Longer command/retry/ACK-copy times are included in lease recovery budgets. Completed survey measurements record whether the receiver acknowledged the final completion message.

Receive rate is unique accepted payload bits divided by total elapsed receiver test time from the control query, including control/waits. It differs from the sender per-window ACK-confirmed goodput chart. Control packets and retries do not increase payload counts. Receiver status explicitly distinguishes Receiving, Complete, Interrupted and Stopped; final rates freeze at completion. An idle link says no new valid packets after 45 seconds rather than falsely declaring completion. Lease expiry and a sender abort message mark interruption. Physical validation on the reported iPhone pair is still required.

## Control-band ACK replies (0.7)

Protocol version 2 negotiates survey replies on the proven control band and symbol duration, while payloads sweep the selected frequency and raw rate. A ten-byte band command with marker 67 opts into this behavior; marker 66 and JSON commands retain the original same-band replies for older senders. The sender configures its listening decoder independently of payload encoding. The receiver encodes ACKs on control without changing its payload listening band.

Timeouts include receiver turnaround, every requested ACK copy, playback tails, the copy gap and a processing margin. A lost first ACK therefore leaves time to decode the second before a retry mutes the microphone. Intentional copies are logged as ACK_REPEAT. Control logs distinguish query, complete and abort; exported senderSurvey retains per-band results and the final outcome even when the bounded event history drops early events. Tests cover a second ACK arriving after the previous timeout, different transmit/ACK bands and rates, and completion. Physical phone goodput still requires measuring both devices.
