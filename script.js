const fileInput = document.getElementById('fileInput');
const audioPlayer = document.getElementById('audioPlayer');
const setStartButton = document.getElementById('setStart');
const setEndButton = document.getElementById('setEnd');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const playStartButton = document.getElementById('playStart');
const progressBar = document.getElementById('progressBar');
const cutStartIndicator = document.getElementById('cutStartIndicator');
const cutEndIndicator = document.getElementById('cutEndIndicator');
const cutButton = document.getElementById('cutButton');
const overlay = document.getElementById('overlay');

let audioContext;
let audioBuffer;
let startTime = 0;
let endTime = 0;

fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
        const arrayBuffer = await file.arrayBuffer();
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const url = URL.createObjectURL(file);
        audioPlayer.src = url;
        audioPlayer.onloadedmetadata = () => {
            endTime = audioPlayer.duration;
            startTime = 0;
            startTimeInput.value = startTime.toFixed(2);
            endTimeInput.value = endTime.toFixed(2);
            updateCutIndicators();
            cutButton.disabled = false;
        };

        audioPlayer.ontimeupdate = updateProgressBar;
    }
});

setStartButton.addEventListener('click', () => {
    startTime = audioPlayer.currentTime;
    startTimeInput.value = startTime.toFixed(2);
    updateCutIndicators();
});

setEndButton.addEventListener('click', () => {
    endTime = audioPlayer.currentTime;
    endTimeInput.value = endTime.toFixed(2);
    updateCutIndicators();
});

playStartButton.addEventListener('click', () => {
    audioPlayer.currentTime = parseFloat(startTimeInput.value);
    audioPlayer.play();
});

startTimeInput.addEventListener('input', () => {
    startTime = parseFloat(startTimeInput.value);
    updateCutIndicators();
});

endTimeInput.addEventListener('input', () => {
    endTime = parseFloat(endTimeInput.value);
    updateCutIndicators();
});

cutButton.addEventListener('click', () => {
    showOverlay();

    setTimeout(() => {
        const startOffset = startTime * audioContext.sampleRate;
        const endOffset = endTime * audioContext.sampleRate;
        const duration = endOffset - startOffset;

        const cutBuffer = audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            duration,
            audioContext.sampleRate
        );

        for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
            cutBuffer.copyToChannel(audioBuffer.getChannelData(i).subarray(startOffset, endOffset), i);
        }

        const mp3Data = bufferToMp3(cutBuffer);
        const blob = new Blob(mp3Data, { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        
        hideOverlay();

        setTimeout(() => {
            const a = document.createElement('a');
            a.href = url;
            a.download = 'cut.mp3';
            document.body.appendChild(a);
            a.click();
            a.remove();
        }, 0);

    }, 0); 
});

function updateProgressBar() {
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressBar.style.width = `${progress}%`;
}

function updateCutIndicators() {
    const startPercent = (startTime / audioPlayer.duration) * 100;
    const endPercent = (endTime / audioPlayer.duration) * 100;
    cutStartIndicator.style.left = `${startPercent}%`;
    cutEndIndicator.style.left = `${endPercent}%`;
}

function bufferToMp3(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const mp3Encoder = new lamejs.Mp3Encoder(numOfChan, sampleRate, 128);

    let mp3Data = [];

    if (numOfChan === 1) {
        const samples = floatTo16BitPCM(buffer.getChannelData(0));
        const mp3Chunk = mp3Encoder.encodeBuffer(samples);
        if (mp3Chunk.length > 0) {
            mp3Data.push(new Uint8Array(mp3Chunk));
        }
    } else if (numOfChan === 2) {
        const leftSamples = floatTo16BitPCM(buffer.getChannelData(0));
        const rightSamples = floatTo16BitPCM(buffer.getChannelData(1));
        const mp3Chunk = mp3Encoder.encodeBuffer(leftSamples, rightSamples);
        if (mp3Chunk.length > 0) {
            mp3Data.push(new Uint8Array(mp3Chunk));
        }
    }

    const mp3End = mp3Encoder.flush();
    if (mp3End.length > 0) {
        mp3Data.push(new Uint8Array(mp3End));
    }

    return mp3Data;
}

function floatTo16BitPCM(input) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
}

function showOverlay() {
    overlay.className = 'visible';
}

function hideOverlay() {
    overlay.className = 'hidden';
}