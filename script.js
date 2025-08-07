const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const uploadSection = document.getElementById('uploadSection');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const results = document.getElementById('results');
const resultBadge = document.getElementById('resultBadge');
const resultScore = document.getElementById('resultScore');
const confidenceLabel = document.getElementById('confidenceLabel');
const processingText = document.getElementById('processingText');

// File input change handler
fileInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
        await analyzeFile(e.target.files[0]);
    }
});

// Upload area click handler
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// Drag and drop handlers
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', async (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    
    if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        await analyzeFile(e.dataTransfer.files[0]);
    }
});

async function analyzeFile(file) {
    // Validate file
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validVideoTypes = ['video/mp4', 'video/quicktime'];
    const validAudioTypes = ['audio/flac', 'audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/ogg'];
    const validTextTypes = ['text/plain'];
    
    let fileType = 'unknown';
    let maxSize = 0;
    
    if (validImageTypes.includes(file.type)) {
        fileType = 'image';
        maxSize = 50 * 1024 * 1024; // 50MB
    } else if (validVideoTypes.includes(file.type)) {
        fileType = 'video';
        maxSize = 250 * 1024 * 1024; // 250MB
    } else if (validAudioTypes.includes(file.type) || file.name.endsWith('.m4a') || file.name.endsWith('.alac')) {
        fileType = 'audio';
        maxSize = 20 * 1024 * 1024; // 20MB
    } else if (validTextTypes.includes(file.type) || file.name.endsWith('.txt')) {
        fileType = 'text';
        maxSize = 5 * 1024 * 1024; // 5MB
    } else {
        showError('Please upload a valid file (image, video, audio, or text)');
        return;
    }

    if (file.size > maxSize) {
        showError(`File size exceeds limit for ${fileType} files`);
        return;
    }

    // Show processing state
    uploadSection.style.display = 'none';
    loading.style.display = 'block';
    processingText.textContent = `Analyzing your ${fileType}...`;
    error.classList.remove('active');
    results.style.display = 'none';

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/analyze', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || 'Analysis failed');
        }

        displayResults(result, fileType);

    } catch (err) {
        showError(err.message || 'Failed to analyze file');
        resetToUpload();
    } finally {
        loading.style.display = 'none';
    }
}

function displayResults(result, fileType) {
    const score = result.score || 0;
    const percentage = Math.round(score * 100);
    
    // Determine if authentic or not
    const isAuthentic = score < 0.5;
    
    // Customize message based on file type
    const mediaTypeLabel = {
        'image': 'Image',
        'video': 'Video',
        'audio': 'Audio',
        'text': 'Text'
    }[fileType] || 'Media';
    
    resultBadge.textContent = isAuthentic ? 'Authentic' : 'AI Generated';
    resultBadge.className = `result-badge ${isAuthentic ? 'authentic' : 'not-authentic'}`;
    resultScore.textContent = `${percentage}%`;
    confidenceLabel.textContent = `${mediaTypeLabel} Deepfake Probability`;
    
    // Populate model details if available
    if (result.models && result.models.length > 0) {
        const modelDetails = document.getElementById('modelDetails');
        modelDetails.innerHTML = '<h4>Individual Model Results:</h4>';
        
        result.models.forEach(model => {
            const modelScore = Math.round((model.score || 0) * 100);
            const modelAuthentic = (model.score || 0) < 0.5;
            const statusClass = modelAuthentic ? 'authentic' : 'manipulated';
            const statusText = model.status || (modelAuthentic ? 'AUTHENTIC' : 'MANIPULATED');
            
            modelDetails.innerHTML += `
                <div class="model-item">
                    <span class="model-name">${model.name}</span>
                    <div class="model-score">
                        <span class="model-status ${statusClass}">${statusText}</span>
                        <span>${modelScore}%</span>
                    </div>
                </div>
            `;
        });
    }
    
    results.style.display = 'block';
}

function showError(message) {
    error.textContent = message;
    error.classList.add('active');
}

function resetUpload() {
    fileInput.value = '';
    resetToUpload();
    results.style.display = 'none';
    error.classList.remove('active');
    document.getElementById('modelDetails').classList.remove('active');
    document.getElementById('detailsToggle').textContent = 'View detailed analysis';
}

function resetToUpload() {
    uploadSection.style.display = 'block';
    loading.style.display = 'none';
}

function toggleDetails() {
    const details = document.getElementById('modelDetails');
    const toggle = document.getElementById('detailsToggle');
    
    if (details.classList.contains('active')) {
        details.classList.remove('active');
        toggle.textContent = 'View detailed analysis';
    } else {
        details.classList.add('active');
        toggle.textContent = 'Hide detailed analysis';
    }
}