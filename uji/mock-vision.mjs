// FaceLandmarker tiruan: pitch, kedipan, dan ada-tidaknya wajah dikendalikan uji.
export const F = { wajah: true, pitch: -10, blink: 0 };
const lm = []; for (let i = 0; i < 468; i++) lm.push({ x: 0.5, y: 0.5 });

export const FilesetResolver = { forVisionTasks: async () => ({}) };
export const FaceLandmarker = {
  createFromOptions: async (x, o) => {
    if (!o.outputFacialTransformationMatrixes) throw new Error('matriks transformasi tidak dinyalakan');
    return {
      detectForVideo: () => {
        if (!F.wajah) return { faceLandmarks: [], faceBlendshapes: [], facialTransformationMatrixes: [] };
        // Kolom ketiga matriks rotasi = sumbu depan wajah; y = sin(pitch).
        const s = Math.sin(F.pitch * Math.PI / 180), c = Math.cos(F.pitch * Math.PI / 180);
        return {
          faceLandmarks: [lm],
          facialTransformationMatrixes: [{ rows: 4, columns: 4, data: [1,0,0,0, 0,c,-s,0, 0,s,c,0, 0,0,-40,1] }],
          faceBlendshapes: [{ categories: [
            { categoryName: 'eyeBlinkLeft', score: F.blink },
            { categoryName: 'eyeBlinkRight', score: F.blink * 0.9 },
            { categoryName: 'eyeLookDownLeft', score: 0 }, { categoryName: 'eyeLookDownRight', score: 0 },
            { categoryName: 'eyeLookUpLeft', score: 0 }, { categoryName: 'eyeLookUpRight', score: 0 }
          ] }]
        };
      }
    };
  }
};
