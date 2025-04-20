document.addEventListener('DOMContentLoaded', function() {
    const moodTextarea = document.getElementById('mood_text');
    const suggestionsContainer = document.querySelector('.mood-suggestions');
    const suggestionsList = document.querySelector('.suggestions-list');

    if (moodTextarea && suggestionsContainer && suggestionsList) {
        const suggestedMoods = [
            "Happy","Peaceful", "Focused", "Melancholic", "Pensive", "Upset",
            "Romantic", "Warm", "Groovy", "Funky", "Upbeat"
            // Add more suggested moods as needed
        ];

        // Function to create a suggestion pill
        function createSuggestionPill(mood) {
            const pill = document.createElement('button');
            pill.classList.add('suggestion-pill');
            pill.textContent = mood;
            pill.addEventListener('click', function(event) {
                event.preventDefault();  // Prevent any default behavior (if any)
                moodTextarea.value = mood;
            });
            return pill;
        }

        // Populate the suggestions list
        suggestedMoods.forEach(mood => {
            const pill = createSuggestionPill(mood);
            suggestionsList.appendChild(pill);
        });

        // Optionally show/hide the suggestions container based on focus
        moodTextarea.addEventListener('focus', function() {
            suggestionsContainer.style.display = 'block';
        });

        moodTextarea.addEventListener('blur', function() {
            // Keep suggestions visible if focused on a pill
            if (!suggestionsList.contains(document.activeElement)) {
                suggestionsContainer.style.display = 'none';
            }
        });

        suggestionsList.addEventListener('focusout', function() {
            // Hide suggestions when focus leaves the list
            if (!moodTextarea.matches(':focus')) {
                suggestionsContainer.style.display = 'none';
            }
        });
    } else {
        console.error("One or more elements for mood suggestions not found.");
    }
});