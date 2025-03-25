<template>
    <div class="scanner-container">
        <div v-if="!errorMessage" class="scanner-wrapper">
            <div id="interactive" class="viewport">
                <video class="videoCamera" autoplay="true" preload="auto" src></video>
                <canvas class="drawingBuffer"></canvas>
            </div>
            <div class="scanner-overlay">
                <div class="scanner-guides" :class="{ 'success': showSuccessOverlay }"></div>
                <div class="scanner-laser"></div>
            </div>
            <div v-if="showSuccessOverlay" class="success-overlay"></div>
        </div>
        <div v-else class="error-container">
            <div class="error-message">
                <p>{{ errorMessage }}</p>
                <button @click="initScanner" class="retry-button">Try Again</button>
            </div>
        </div>
    </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as Quagga from '@ericblade/quagga2';
import { EventBus } from './eventBus';

export default {
    name: 'BarcodeScanner',
    emits: ['barcode-detected'],

    setup(props, { emit }) {
        const errorMessage = ref(null);
        const lastScannedCode = ref(null);
        const lastScannedTime = ref(0);
        const isScanning = ref(false);
        const confidenceThreshold = 0.7; // Increased back to original value
        const showSuccessOverlay = ref(false); // Add this for visual feedback
        let scannerInitialized = false;
        let scanSound = null; // Add this for audio feedback

        // Initialize the scanner
        const initScanner = async () => {
            // Force cleanup of any existing scanner
            stopScanner();
            
            // Reset state
            scannerInitialized = false;
            errorMessage.value = null;
            
            try {
                // Check camera permission first
                await checkCameraPermission();
                
                // Small delay to ensure camera is fully released before reinitialization
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Initialize Quagga
                await Quagga.init({
                    inputStream: {
                        name: "Live",
                        type: "LiveStream",
                        target: document.getElementById("interactive"),
                        constraints: {
                            width: 640,
                            height: 480,
                            facingMode: "environment"
                        },
                        area: {
                            top: "10%",
                            right: "10%",
                            left: "10%",
                            bottom: "10%"
                        }
                    },
                    locator: {
                        patchSize: "medium",
                        halfSample: true
                    },
                    numOfWorkers: 2,
                    frequency: 10,
                    decoder: {
                        readers: [
                            "code_128_reader",
                            "ean_reader",
                            "ean_8_reader",
                            "code_39_reader",
                            "upc_reader",
                            "upc_e_reader"
                        ]
                    }
                }, function(err) {
                    if (err) {
                        errorMessage.value = `Failed to initialize scanner: ${err.message || 'Unknown error'}`;
                        return;
                    }
                    
                    scannerInitialized = true;

                    // Register event handlers
                    Quagga.offDetected(handleBarcodeDetected);
                    Quagga.offProcessed(handleProcessed);
                    Quagga.onDetected(handleBarcodeDetected);
                    Quagga.onProcessed(handleProcessed);

                    // Start scanning - without logging
                    try {
                        const startResult = Quagga.start();
                        
                        if (startResult && typeof startResult.then === 'function') {
                            // If it returns a Promise, use it
                            startResult
                                .then(() => {
                                    isScanning.value = true;
                                    EventBus.emit('message', { type: 'status', text: 'Camera ready for scanning' });
                                })
                                .catch(startErr => {
                                    errorMessage.value = `Error starting scanner: ${startErr.message || 'Unknown error'}`;
                                    scannerInitialized = false;
                                });
                        } else {
                            // If it doesn't return a Promise, assume it started successfully
                            isScanning.value = true;
                            EventBus.emit('message', { type: 'status', text: 'Camera ready for scanning' });
                        }
                    } catch (startErr) {
                        errorMessage.value = `Error starting scanner: ${startErr.message || 'Unknown error'}`;
                        scannerInitialized = false;
                    }
                });
            } catch (err) {
                // Handle specific error cases
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    errorMessage.value = 'Camera access denied. Please grant permission and try again.';
                } else if (err.name === 'NotFoundError') {
                    errorMessage.value = 'No camera found. Please make sure your device has a camera.';
                } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                    errorMessage.value = 'Camera in use by another application. Please close other camera apps and try again.';
                } else {
                    errorMessage.value = `Scanner error: ${err.message || 'Unknown error'}`;
                }

                EventBus.emit('message', { type: 'error', text: errorMessage.value });
                scannerInitialized = false;
            }
        };

        // Check if we have camera permission
        const checkCameraPermission = async () => {
            // Make sure MediaDevices API is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Your browser does not support camera access');
            }

            try {
                // Request camera permission
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                // Immediately release the camera
                stream.getTracks().forEach(track => track.stop());
                return true;
            } catch (err) {
                console.error("Camera permission error:", err);
                throw err;
            }
        };

        // Clean up the initScanSound function
        const initScanSound = () => {
            try {
                // Create an AudioContext for more reliable sound
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) {
                    return;
                }
                
                // Create audio context
                const audioCtx = new AudioContext();
                
                // Function to play beep when needed
                scanSound = {
                    play: () => {
                        try {
                            const oscillator = audioCtx.createOscillator();
                            const gainNode = audioCtx.createGain();
                            
                            oscillator.type = 'sine';
                            oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // beep frequency
                            oscillator.connect(gainNode);
                            gainNode.connect(audioCtx.destination);
                            
                            // Short beep
                            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
                            gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.01);
                            gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
                            
                            oscillator.start();
                            oscillator.stop(audioCtx.currentTime + 0.2);
                        } catch (err) {
                            // Silent error handling
                        }
                    }
                };
                
                // Resume audio context on user interaction to handle autoplay policies
                document.addEventListener('click', () => {
                    if (audioCtx.state === 'suspended') {
                        audioCtx.resume();
                    }
                }, { once: true });
                
            } catch (error) {
                // Silent error handling
            }
        };

        // Simplify the play function
        const playScanSound = () => {
            if (scanSound && scanSound.play) {
                scanSound.play();
            }
        };

        // Show success overlay visual feedback
        const showSuccessFeedback = () => {
            showSuccessOverlay.value = true;
            setTimeout(() => {
                showSuccessOverlay.value = false;
            }, 500); // Flash for 500ms
        };

        // Clean up the handleBarcodeDetected function
        const handleBarcodeDetected = async (result) => {
            if (!result || !result.codeResult) return;

            const code = result.codeResult.code;
            const format = result.codeResult.format;
            const currentTime = Date.now();

            // Prevent duplicate scans within 5 seconds
            if (code === lastScannedCode.value && (currentTime - lastScannedTime.value) < 5000) {
                return;
            }

            try {
                // Check if the item exists before emitting
                const response = await fetch(`/api/v1/items?external_id=${encodeURIComponent(code)}`);

                if (!response.ok) {
                    EventBus.emit('message', {
                        type: 'error',
                        text: `Error validating barcode: ${response.statusText}`
                    });
                    return;
                }

                const items = await response.json();

                if (!items || items.length === 0) {
                    EventBus.emit('message', {
                        type: 'error',
                        text: `Barcode not found: ${code}`
                    });
                    return;
                }

                // Update tracking variables
                lastScannedCode.value = code;
                lastScannedTime.value = currentTime;

                // Visual and audio feedback
                showSuccessFeedback();
                playScanSound();
                
                // Emit the event with the barcode
                emit('barcode-detected', code);

                // Visual feedback to user
                EventBus.emit('message', {
                    type: 'status',
                    text: `Barcode detected: ${code}`
                });

                // Brief pause of scanning without stopping the camera
                isScanning.value = false;
                setTimeout(() => {
                    isScanning.value = true;
                }, 1500);

            } catch (error) {
                EventBus.emit('message', {
                    type: 'error',
                    text: `Error checking barcode: ${error.message}`
                });
            }
        };

        // Process and draw detection results
        const handleProcessed = (result) => {
            if (!result) return;

            const drawingCanvas = Quagga.canvas.dom.overlay;
            const drawingCtx = Quagga.canvas.ctx.overlay;

            if (!drawingCanvas || !drawingCtx) return;

            // Clear previous drawings
            drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);

            // If a barcode is detected, draw the box and line
            if (result.boxes && result.codeResult && result.codeResult.code) {
                // Draw box around detected barcode
                if (result.box) {
                    Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, { color: "green", lineWidth: 3 });
                }

                if (result.line) {
                    Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, drawingCtx, { color: 'red', lineWidth: 4 });
                }
            }
        };

        // Clean up the stopScanner function
        const stopScanner = () => {
            try {
                if (scannerInitialized) {
                    // Remove event handlers
                    Quagga.offDetected(handleBarcodeDetected);
                    Quagga.offProcessed(handleProcessed);
                    
                    // Stop Quagga
                    Quagga.stop();
                    
                    // Get all video elements and stop their tracks
                    const videoElements = document.querySelectorAll('video');
                    videoElements.forEach(video => {
                        if (video.srcObject) {
                            const tracks = video.srcObject.getTracks();
                            tracks.forEach(track => {
                                track.stop();
                            });
                            video.srcObject = null;
                        }
                    });
                    
                    // Reset scanner state
                    scannerInitialized = false;
                }
                isScanning.value = false;
            } catch (error) {
                scannerInitialized = false;
            }
        };

        // Setup and cleanup
        onMounted(() => {
            initScanSound();
            initScanner();
        });

        onBeforeUnmount(() => {
            stopScanner();
        });

        return {
            errorMessage,
            initScanner,
            showSuccessOverlay
        };
    }
};
</script>

<style scoped>
.scanner-container {
    position: relative;
    width: 100%;
    max-width: 640px;
    height: 400px;
    margin: 0 auto;
    overflow: hidden;
    border: 2px solid #444;
    border-radius: 8px;
    background-color: #000;
}

.scanner-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
}

.viewport {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
}

.videoCamera {
    width: 100%;
    height: 100%;
    object-fit: cover;
    position: absolute;
    top: 0;
    left: 0;
}

.drawingBuffer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

/* Add a glass effect overlay */
.viewport::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(45deg,
            rgba(255, 255, 255, 0.1) 0%,
            rgba(255, 255, 255, 0.05) 100%);
    z-index: 2;
    pointer-events: none;
}

.scanner-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 3;
}

.scanner-guides {
    position: absolute;
    top: 5%;
    /* Reduced from 10% */
    left: 5%;
    /* Reduced from 10% */
    width: 90%;
    /* Increased from 80% */
    height: 90%;
    /* Increased from 80% */
    border: 3px solid rgba(50, 205, 50, 0.9);
    border-radius: 6px;
    box-shadow: 0 0 0 1000px rgba(0, 0, 0, 0.3);
}

.scanner-laser {
    position: absolute;
    top: 50%;
    left: 5%;
    /* Reduced from 10% */
    right: 5%;
    /* Reduced from 10% */
    height: 3px;
    background: rgba(255, 0, 0, 0.9);
    box-shadow: 0 0 8px rgba(255, 0, 0, 0.8);
    animation: scan 1.5s ease-in-out infinite;
}

.error-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background-color: #f8f8f8;
}

.error-message {
    text-align: center;
    padding: 20px;
    background-color: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    max-width: 80%;
}

.error-message p {
    margin-bottom: 15px;
    color: #e53935;
}

.retry-button {
    background-color: #2196F3;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.3s;
}

.retry-button:hover {
    background-color: #1976D2;
}

@keyframes scan {
    0% {
        transform: translateY(-150px);
        opacity: 0.7;
    }

    50% {
        opacity: 1;
    }

    100% {
        transform: translateY(150px);
        opacity: 0.7;
    }
}

@media (max-width: 768px) {
    .scanner-container {
        height: 300px;
    }

    .videoCamera {
        object-fit: cover;
        width: 100%;
        height: 100%;
    }
}

.success-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(40, 200, 40, 0.3);
    z-index: 5;
    pointer-events: none;
    animation: pulse 0.5s ease-in-out;
}

.scanner-guides.success {
    border-color: rgba(40, 200, 40, 0.9);
    box-shadow: 0 0 15px rgba(40, 200, 40, 0.7);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

@keyframes pulse {
    0% {
        opacity: 0;
    }
    50% {
        opacity: 0.7;
    }
    100% {
        opacity: 0;
    }
}
</style>
