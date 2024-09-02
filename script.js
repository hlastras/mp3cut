const fileInput = document.getElementById('fileInput');
const audioPlayer = document.getElementById('audioPlayer');
const setStartButton = document.getElementById('setStart');
const setEndButton = document.getElementById('setEnd');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const progressBar = document.getElementById('progressBar');
const cutStartIndicator = document.getElementById('cutStartIndicator');
const cutEndIndicator = document.getElementById('cutEndIndicator');
const cutButton = document.getElementById('cutButton');

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
            endTimeInput.value = endTime.toFixed(2);
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

startTimeInput.addEventListener('input', () => {
    startTime = parseFloat(startTimeInput.value);
    updateCutIndicators();
});

endTimeInput.addEventListener('input', () => {
    endTime = parseFloat(endTimeInput.value);
    updateCutIndicators();
});

cutButton.addEventListener('click', () => {
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
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cut.mp3';
    document.body.appendChild(a);
    a.click();
    a.remove();
});

function bufferToMp3(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const mp3Encoder = new lamejs.Mp3Encoder(numOfChan, sampleRate, 128);

    let mp3Data = [];

    if (numOfChan === 1) {
        // Audio mono
        const samples = floatTo16BitPCM(buffer.getChannelData(0));
        const mp3Chunk = mp3Encoder.encodeBuffer(samples);
        if (mp3Chunk.length > 0) {
            mp3Data.push(new Uint8Array(mp3Chunk));
        }
    } else if (numOfChan === 2) {
        // Audio estéreo
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

function audioBufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels,
        length = buffer.length * numOfChan * 2 + 44,
        bufferToWav = new ArrayBuffer(length),
        view = new DataView(bufferToWav),
        channels = [];
    
    let sample,
        offset = 0,
        pos = 0;

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit (hardcoded in this example)

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    for (let i = 0; i < buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

    while (pos < length) {
        for (let i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset])); // Here sample is set for each channel
            view.setInt16(pos, sample * 0x7fff, true);
            pos += 2;
        }
        offset++;
    }

    return bufferToWav;

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
}

