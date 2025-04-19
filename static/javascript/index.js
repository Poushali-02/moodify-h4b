document.addEventListener('DOMContentLoaded', () => {
    // Form validation for mood input
    const moodForm = document.querySelector('form');
    const moodTextarea = document.getElementById('mood_text');
    
    if (moodForm) {
        moodForm.addEventListener('submit', (e) => {
            if (!moodTextarea.value.trim()) {
                e.preventDefault();
                showError('Please tell us how you\'re feeling');
                moodTextarea.classList.add('error');
            }
        });
        
        // Remove error styling on input
        moodTextarea.addEventListener('input', () => {
            if (moodTextarea.classList.contains('error')) {
                moodTextarea.classList.remove('error');
                clearError();
            }
        });
    }
    
    // Show error message
    function showError(message) {
        // Check if error message already exists
        let errorElement = document.querySelector('.error-message');
        
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'error-message';
            moodForm.insertBefore(errorElement, moodForm.firstChild);
        }
        
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
    
    // Clear error message
    function clearError() {
        const errorElement = document.querySelector('.error-message');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }
    
    // Add some mood suggestions if desired
    const moodSuggestions = [
        "I'm feeling really happy and energetic today!",
        "I've been feeling a bit down lately",
        "Need to focus on my work right now",
        "Looking for something to help me relax after a long day"
    ];
    
    // Create mood suggestions section if textarea exists
    if (moodTextarea) {
        const suggestionsContainer = document.createElement('div');
        suggestionsContainer.className = 'mood-suggestions';
        suggestionsContainer.innerHTML = '<p>Try these:</p>';
        
        const suggestionsList = document.createElement('div');
        suggestionsList.className = 'suggestions-list';
        
        moodSuggestions.forEach(suggestion => {
            const pill = document.createElement('button');
            pill.type = 'button';
            pill.className = 'suggestion-pill';
            pill.textContent = suggestion.substring(0, 25) + (suggestion.length > 25 ? '...' : '');
            pill.setAttribute('data-full-text', suggestion);
            
            pill.addEventListener('click', () => {
                moodTextarea.value = suggestion;
                clearError();
                moodTextarea.classList.remove('error');
            });
            
            suggestionsList.appendChild(pill);
        });
        
        suggestionsContainer.appendChild(suggestionsList);
        moodTextarea.parentNode.insertBefore(suggestionsContainer, moodTextarea.nextSibling);
    }
});