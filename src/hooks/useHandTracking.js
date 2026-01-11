import { useEffect, useRef, useState } from 'react';

// Use the global constructors from index.html CDN
const getHands = () => window.Hands || (window.HandsNamespace && window.HandsNamespace.Hands);
const getCamera = () => window.Camera || (window.CameraNamespace && window.CameraNamespace.Camera);

export function useHandTracking() {
    const videoRef = useRef(null);
    const [handPosition, setHandPosition] = useState(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        let hands;
        let camera;
        let checkInterval;

        const initHandTracking = () => {
            const Hands = getHands();
            const Camera = getCamera();

            if (!Hands || !Camera) {
                return false;
            }

            hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                }
            });

            hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            hands.onResults((results) => {
                if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                    const landmarks = results.multiHandLandmarks[0];
                    const indexTip = landmarks[8];
                    setHandPosition({
                        x: indexTip.x,
                        y: indexTip.y,
                        landmarks: landmarks
                    });
                } else {
                    setHandPosition(null);
                }
            });

            if (videoRef.current) {
                camera = new Camera(videoRef.current, {
                    onFrame: async () => {
                        await hands.send({ image: videoRef.current });
                    },
                    width: 640,
                    height: 480
                });
                camera.start();
                setIsReady(true);
            }
            return true;
        };

        if (!initHandTracking()) {
            checkInterval = setInterval(() => {
                if (initHandTracking()) {
                    clearInterval(checkInterval);
                }
            }, 100);
        }

        return () => {
            if (checkInterval) clearInterval(checkInterval);
            if (hands) hands.close();
            if (camera) camera.stop();
        };
    }, []);

    return { videoRef, handPosition, isReady };
}
