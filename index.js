// User Authentication
let currentUser = null;
let tasks = [];
let currentView = 'my-day';
let token = localStorage.getItem('token') || null;

const API = "http://localhost:5001/api";




// Show/Hide Containers
function showContainer(containerId) {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('registerContainer').style.display = 'none';
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById(containerId).style.display = containerId === 'appContainer' ? 'flex' : 'block';
}

// Authentication Event Listeners
document.getElementById('showRegister').addEventListener('click', () => showContainer('registerContainer'));
document.getElementById('showLogin').addEventListener('click', () => showContainer('loginContainer'));

// Login Handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    try {
        const res = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Login failed');
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(currentUser));
        await fetchTasks();
        updateLoginStreak(currentUser);
        showContainer('appContainer');
        updateProfileSection(currentUser);
        renderTasks();
        updateAIRecommendations();
    } catch (err) {
        alert(err.message);
    }
});

// Register Handler
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    try {
        const res = await fetch(`${API}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Registration failed');
        alert('Account created! Please login.');
        showContainer('loginContainer');
    } catch (err) {
        alert(err.message);
    }
});

// Logout Handler
document.getElementById('logoutBtn').addEventListener('click', () => {
    token = null;
    currentUser = null;
    tasks = [];
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    showContainer('loginContainer');
});

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        if (e.currentTarget.dataset.view) {
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentView = e.currentTarget.dataset.view;
            
            // Update the current view text with proper formatting
            const viewText = e.currentTarget.textContent.trim();
            const currentViewElement = document.getElementById('currentView');
            
            // Map view names to display names
            const viewDisplayNames = {
                'my-day': 'My Day',
                'important': 'Important',
                'planned': 'Planned',
                'tasks': 'All Tasks'
            };
            
            currentViewElement.textContent = viewDisplayNames[currentView] || viewText;
            renderTasks();
        }
    });
});

// Login Streak Management
function updateLoginStreak(user) {
    const now = new Date();
    const today = now.toDateString();
    if (!user.lastLogin) {
        user.loginStreak = 1;
    } else {
        const lastLogin = new Date(user.lastLogin);
        const dayDiff = Math.floor((now - lastLogin) / (1000 * 60 * 60 * 24));
        if (dayDiff === 1) {
            user.loginStreak = (user.loginStreak || 0) + 1;
        } else if (dayDiff > 1) {
            user.loginStreak = 1;
        }
    }
    user.lastLogin = today;
    updateStreakDisplay(user.loginStreak);
}

function updateStreakDisplay(streak) {
    const streakElement = document.getElementById('loginStreak');
    streakElement.textContent = `Login Streak: ${streak} day${streak !== 1 ? 's' : ''}`;
}

function updateProfileSection(user) {
    // Update profile avatar with user initial
    const profileInitial = document.getElementById('profileInitial');
    const profileName = document.getElementById('profileName');
    const profileStatus = document.getElementById('profileStatus');
    
    if (user && user.username) {
        const initial = user.username.charAt(0).toUpperCase();
        profileInitial.textContent = initial;
        profileName.textContent = user.username;
        
        // Generate a motivational status based on time of day
        const hour = new Date().getHours();
        let status = '';
        if (hour < 12) {
            status = 'Ready to conquer the day!';
        } else if (hour < 17) {
            status = 'Staying productive!';
        } else if (hour < 21) {
            status = 'Winding down gracefully';
        } else {
            status = 'Time for some rest';
        }
        profileStatus.textContent = status;
    }
}

// Task Management
async function fetchTasks() {
    if (!token) return;
    try {
        const res = await fetch(`${API}/tasks`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch tasks');
        tasks = await res.json();
    } catch (err) {
        tasks = [];
        alert('Could not load tasks: ' + err.message);
    }
}

async function addTask() {
    const text = document.getElementById('taskInput').value.trim();
    const priority = document.getElementById('prioritySelect').value;
    if (text && currentUser) {
        const dueDate = document.getElementById('dueDateInput').value;
        const tags = document.getElementById('tagInput').value.split(',').map(t => t.trim()).filter(Boolean);
        const recurring = document.getElementById('recurringInput').value;
        const reminder = document.getElementById('reminderInput').value;
        
        // Set flags based on current view
        let important = false;
        let myDay = false;
        
        switch(currentView) {
            case 'important':
                important = true;
                break;
            case 'my-day':
                myDay = true;
                // Tasks added in "My Day" view will only appear in "My Day" and not in general "Tasks" view
                break;
            case 'planned':
                // For planned view, we'll rely on the due date being set
                break;
            case 'tasks':
                // For general tasks view, no special flags - these tasks will appear in all views except "My Day"
                break;
        }
        
        const newTask = {
            text,
            completed: false,
            important: important,
            myDay: myDay,
            priority,
            dueDate: dueDate ? new Date(dueDate).toISOString() : null,
            tags,
            recurring,
            reminder,
            created: new Date().toISOString()
        };
        try {
            const res = await fetch(`${API}/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newTask)
            });
            if (!res.ok) throw new Error('Failed to add task');
            const saved = await res.json();
            tasks.unshift(saved);
            document.getElementById('taskInput').value = '';
            document.getElementById('prioritySelect').value = 'low';
            document.getElementById('dueDateInput').value = '';
            document.getElementById('tagInput').value = '';
            document.getElementById('recurringInput').value = '';
            document.getElementById('reminderInput').value = '';
            renderTasks();
            analyzeTask(0, text);
            updateAIRecommendations();
            scheduleReminder(saved);
        } catch (err) {
            alert('Could not add task: ' + err.message);
        }
    }
}

async function updateTask(id, updates) {
    try {
        const res = await fetch(`${API}/tasks/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update task');
        const updated = await res.json();
        const idx = tasks.findIndex(t => t._id === id);
        if (idx !== -1) tasks[idx] = updated;
        renderTasks();
        updateAIRecommendations();
    } catch (err) {
        alert('Could not update task: ' + err.message);
    }
}

async function deleteTask(id) {
    // Find the task element and add deleting class for animation
    const taskElement = document.querySelector(`[onclick*="${id}"]`).closest('.task-item');
    if (taskElement) {
        taskElement.classList.add('deleting');
        
        // Wait for animation to complete before actually deleting
        setTimeout(async () => {
            try {
                const res = await fetch(`${API}/tasks/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to delete task');
                tasks = tasks.filter(t => t._id !== id);
                renderTasks();
                updateAIRecommendations();
            } catch (err) {
                alert('Could not delete task: ' + err.message);
                // Remove the deleting class if deletion failed
                taskElement.classList.remove('deleting');
            }
        }, 300); // Match the animation duration
    } else {
        // Fallback if element not found
        try {
            const res = await fetch(`${API}/tasks/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to delete task');
            tasks = tasks.filter(t => t._id !== id);
            renderTasks();
            updateAIRecommendations();
        } catch (err) {
            alert('Could not delete task: ' + err.message);
        }
    }
}

function toggleTask(id) {
    const task = tasks.find(t => t._id === id);
    if (task) {
        updateTask(id, { completed: !task.completed });
    }
}

function toggleImportant(id) {
    const task = tasks.find(t => t._id === id);
    if (task) {
        updateTask(id, { important: !task.important });
    }
}

function toggleMyDay(id) {
    const task = tasks.find(t => t._id === id);
    if (task) {
        updateTask(id, { myDay: !task.myDay });
    }
}

// AI Recommendations
function updateAIRecommendations() {
    const aiSummary = document.getElementById('aiSummary');
    const incomplete = tasks.filter(task => !task.completed);
    let highCount = incomplete.filter(task => task.priority === 'high').length;
    let mediumCount = incomplete.filter(task => task.priority === 'medium').length;
    let lowCount = incomplete.filter(task => task.priority === 'low').length;
    let suggestions = [];

    // Priority-based suggestions
    if (highCount > 0)
        suggestions.push(`⚠️ You have ${highCount} high-priority pending task${highCount > 1 ? 's' : ''} that need immediate attention!`);
    if (mediumCount > 0)
        suggestions.push(`You have ${mediumCount} medium-priority pending task${mediumCount > 1 ? 's' : ''}.`);
    if (lowCount > 0)
        suggestions.push(`You have ${lowCount} lower-priority pending task${lowCount > 1 ? 's' : ''}.`);

    const allTaskTexts = tasks.map(task => task.text.toLowerCase());
    
    // Enhanced category detection with more keywords
    const categories = {
        work: ['meeting', 'project', 'deadline', 'report', 'presentation', 'email', 'client', 'work', 'office', 'business', 'conference', 'interview'],
        health: ['exercise', 'gym', 'workout', 'run', 'fitness', 'meditation', 'yoga', 'health', 'diet', 'nutrition', 'sleep', 'doctor', 'appointment'],
        study: ['study', 'homework', 'assignment', 'exam', 'research', 'read', 'book', 'course', 'class', 'lecture', 'notes', 'learning', 'education'],
        personal: ['shopping', 'clean', 'cook', 'laundry', 'groceries', 'bills', 'family', 'personal', 'home', 'house', 'apartment', 'repair', 'maintenance'],
        reading: ['read', 'book', 'novel', 'literature', 'author', 'story', 'fiction', 'non-fiction', 'magazine', 'article', 'blog', 'comic', 'manga'],
        entertainment: ['movie', 'film', 'watch', 'series', 'show', 'tv', 'video', 'game', 'play', 'music', 'concert', 'theater', 'performance'],
        travel: ['travel', 'trip', 'vacation', 'holiday', 'flight', 'hotel', 'booking', 'reservation', 'destination', 'tour', 'sightseeing', 'adventure'],
        finance: ['money', 'budget', 'finance', 'investment', 'savings', 'bank', 'account', 'bill', 'payment', 'tax', 'insurance', 'mortgage', 'loan']
    };

    // Track user interests based on task categories
    let userInterests = {};
    for (const [category, keywords] of Object.entries(categories)) {
        const categoryTasks = allTaskTexts.filter(text => 
            keywords.some(keyword => text.includes(keyword))
        );
        userInterests[category] = categoryTasks.length;
    }

    // Generate personalized recommendations based on interests
    for (const [category, count] of Object.entries(userInterests)) {
        if (count > 0) {
            switch(category) {
                case 'work':
                    if (count >= 2) {
                        suggestions.push(`Based on your work-related tasks, consider adding: "Follow up on previous meetings" or "Update project timeline".`);
                    }
                    break;
                case 'health':
                    if (!allTaskTexts.some(text => text.includes('workout'))) {
                        suggestions.push(`I notice you're interested in health. Consider adding a workout schedule to your tasks.`);
                    }
                    break;
                case 'study':
                    if (count > 0) {
                        suggestions.push(`For better study management, consider adding review sessions for your ${category} tasks.`);
                    }
                    break;
                case 'personal':
                    if (count >= 2) {
                        suggestions.push(`For personal tasks, don't forget to schedule some relaxation time.`);
                    }
                    break;
                case 'reading':
                    // Advanced reading recommendations
                    if (count > 0) {
                        const readingPreferences = detectReadingPreferences(allTaskTexts);
                        const bookRecommendations = getBookRecommendations(readingPreferences);
                        suggestions.push(`Based on your interest in reading, I recommend: ${bookRecommendations.join(', ')}`);
                    }
                    break;
                case 'entertainment':
                    if (count > 0) {
                        const entertainmentPreferences = detectEntertainmentPreferences(allTaskTexts);
                        const entertainmentRecommendations = getEntertainmentRecommendations(entertainmentPreferences);
                        suggestions.push(`For entertainment, you might enjoy: ${entertainmentRecommendations.join(', ')}`);
                    }
                    break;
                case 'travel':
                    if (count > 0) {
                        const travelPreferences = detectTravelPreferences(allTaskTexts);
                        const travelRecommendations = getTravelRecommendations(travelPreferences);
                        suggestions.push(`For your travel plans, consider: ${travelRecommendations.join(', ')}`);
                    }
                    break;
                case 'finance':
                    if (count > 0) {
                        suggestions.push(`For financial planning, consider adding: "Review monthly budget" or "Set up automatic savings".`);
                    }
                    break;
            }
        }
    }

    // Time-based pattern recognition
    const completedTasks = tasks.filter(task => task.completed);
    if (completedTasks.length > 0) {
        const repeatingPatterns = completedTasks
            .map(task => task.text.toLowerCase())
            .filter((text, index, array) => array.indexOf(text) !== index);
        
        if (repeatingPatterns.length > 0) {
            suggestions.push(`I noticed you complete similar tasks regularly. Consider adding: "${repeatingPatterns[0]}" to your list.`);
        }
    }

    // Contextual recommendations
    const timeOfDay = new Date().getHours();
    if (timeOfDay < 12 && !allTaskTexts.some(text => text.includes('morning'))) {
        suggestions.push(`It's morning time. Consider adding morning routine tasks to your list.`);
    } else if (timeOfDay >= 12 && timeOfDay < 17 && !allTaskTexts.some(text => text.includes('afternoon'))) {
        suggestions.push(`It's afternoon. Good time to add some productive tasks.`);
    } else if (timeOfDay >= 17 && !allTaskTexts.some(text => text.includes('evening'))) {
        suggestions.push(`Evening is approaching. Consider adding some wind-down tasks.`);
    }

    // Seasonal recommendations
    const month = new Date().getMonth();
    if (month >= 11 || month <= 1) { // Winter
        if (!allTaskTexts.some(text => text.includes('holiday') || text.includes('christmas'))) {
            suggestions.push(`It's winter season. Consider adding holiday preparation tasks.`);
        }
    } else if (month >= 2 && month <= 4) { // Spring
        if (!allTaskTexts.some(text => text.includes('spring') || text.includes('garden'))) {
            suggestions.push(`It's spring season. Consider adding outdoor activities or spring cleaning tasks.`);
        }
    } else if (month >= 5 && month <= 7) { // Summer
        if (!allTaskTexts.some(text => text.includes('summer') || text.includes('vacation'))) {
            suggestions.push(`It's summer season. Consider adding vacation planning or outdoor activities.`);
        }
    } else if (month >= 8 && month <= 10) { // Fall
        if (!allTaskTexts.some(text => text.includes('fall') || text.includes('autumn'))) {
            suggestions.push(`It's fall season. Consider adding seasonal activities or preparation for winter.`);
        }
    }

    aiSummary.innerText = suggestions.length > 0 ? "AI Recommendations: " + suggestions.join(" ") : "No AI recommendations available.";
}

// Advanced reading preference detection
function detectReadingPreferences(taskTexts) {
    const preferences = {
        genres: [],
        authors: [],
        themes: [],
        difficulty: 'medium'
    };
    
    // Genre detection
    const genres = {
        fantasy: ['fantasy', 'magic', 'wizard', 'dragon', 'mythical', 'supernatural'],
        sciFi: ['sci-fi', 'science fiction', 'space', 'future', 'robot', 'alien', 'technology'],
        mystery: ['mystery', 'detective', 'crime', 'thriller', 'suspense', 'investigation'],
        romance: ['romance', 'love', 'relationship', 'dating', 'romantic'],
        historical: ['historical', 'history', 'period', 'ancient', 'medieval', 'victorian'],
        literary: ['literary', 'classic', 'award-winning', 'prize', 'literature'],
        nonFiction: ['non-fiction', 'biography', 'memoir', 'self-help', 'educational', 'factual']
    };
    
    for (const [genre, keywords] of Object.entries(genres)) {
        if (taskTexts.some(text => keywords.some(keyword => text.includes(keyword)))) {
            preferences.genres.push(genre);
        }
    }
    
    // Author detection
    const commonAuthors = [
        'tolkien', 'rowling', 'king', 'austen', 'dickens', 'shakespeare', 'twain', 
        'hemingway', 'fitzgerald', 'dostoevsky', 'tolstoy', 'hugo', 'dante', 'homer',
        'asimov', 'bradbury', 'orwell', 'huxley', 'christie', 'doyle', 'poe'
    ];
    
    for (const author of commonAuthors) {
        if (taskTexts.some(text => text.includes(author))) {
            preferences.authors.push(author);
        }
    }
    
    // Theme detection
    const themes = {
        adventure: ['adventure', 'journey', 'quest', 'exploration', 'discovery'],
        comingOfAge: ['coming of age', 'growing up', 'maturity', 'youth', 'teen'],
        dystopian: ['dystopian', 'apocalypse', 'post-apocalyptic', 'society', 'government'],
        philosophical: ['philosophical', 'philosophy', 'meaning', 'existence', 'consciousness'],
        psychological: ['psychological', 'mind', 'mental', 'psychology', 'behavior']
    };
    
    for (const [theme, keywords] of Object.entries(themes)) {
        if (taskTexts.some(text => keywords.some(keyword => text.includes(keyword)))) {
            preferences.themes.push(theme);
        }
    }
    
    // Difficulty detection
    if (taskTexts.some(text => text.includes('easy') || text.includes('simple') || text.includes('beginner'))) {
        preferences.difficulty = 'easy';
    } else if (taskTexts.some(text => text.includes('challenging') || text.includes('complex') || text.includes('advanced'))) {
        preferences.difficulty = 'hard';
    }
    
    return preferences;
}

// Get personalized book recommendations
function getBookRecommendations(preferences) {
    const recommendations = [];
    
    // If no specific preferences, provide general recommendations
    if (preferences.genres.length === 0 && preferences.authors.length === 0 && preferences.themes.length === 0) {
        return [
            "The Alchemist by Paulo Coelho",
            "To Kill a Mockingbird by Harper Lee",
            "The Great Gatsby by F. Scott Fitzgerald"
        ];
    }
    
    // Genre-based recommendations
    if (preferences.genres.includes('fantasy')) {
        recommendations.push("The Name of the Wind by Patrick Rothfuss");
        recommendations.push("Mistborn by Brandon Sanderson");
    }
    if (preferences.genres.includes('sciFi')) {
        recommendations.push("Dune by Frank Herbert");
        recommendations.push("The Martian by Andy Weir");
    }
    if (preferences.genres.includes('mystery')) {
        recommendations.push("The Silent Patient by Alex Michaelides");
        recommendations.push("Gone Girl by Gillian Flynn");
    }
    if (preferences.genres.includes('romance')) {
        recommendations.push("The Notebook by Nicholas Sparks");
        recommendations.push("Me Before You by Jojo Moyes");
    }
    if (preferences.genres.includes('historical')) {
        recommendations.push("The Pillars of the Earth by Ken Follett");
        recommendations.push("Wolf Hall by Hilary Mantel");
    }
    if (preferences.genres.includes('literary')) {
        recommendations.push("The Goldfinch by Donna Tartt");
        recommendations.push("A Little Life by Hanya Yanagihara");
    }
    if (preferences.genres.includes('nonFiction')) {
        recommendations.push("Sapiens by Yuval Noah Harari");
        recommendations.push("Educated by Tara Westover");
    }
    
    // Author-based recommendations
    if (preferences.authors.includes('tolkien')) {
        recommendations.push("The Hobbit by J.R.R. Tolkien");
        recommendations.push("The Lord of the Rings by J.R.R. Tolkien");
    }
    if (preferences.authors.includes('king')) {
        recommendations.push("The Shining by Stephen King");
        recommendations.push("It by Stephen King");
    }
    if (preferences.authors.includes('austen')) {
        recommendations.push("Pride and Prejudice by Jane Austen");
        recommendations.push("Emma by Jane Austen");
    }
    
    // Theme-based recommendations
    if (preferences.themes.includes('adventure')) {
        recommendations.push("The Da Vinci Code by Dan Brown");
        recommendations.push("The Three Musketeers by Alexandre Dumas");
    }
    if (preferences.themes.includes('dystopian')) {
        recommendations.push("1984 by George Orwell");
        recommendations.push("Brave New World by Aldous Huxley");
    }
    if (preferences.themes.includes('philosophical')) {
        recommendations.push("The Stranger by Albert Camus");
        recommendations.push("Thus Spoke Zarathustra by Friedrich Nietzsche");
    }
    
    // Difficulty-based recommendations
    if (preferences.difficulty === 'easy') {
        recommendations.push("The Giver by Lois Lowry");
        recommendations.push("Charlotte's Web by E.B. White");
    } else if (preferences.difficulty === 'hard') {
        recommendations.push("Ulysses by James Joyce");
        recommendations.push("Infinite Jest by David Foster Wallace");
    }
    
    // Remove duplicates and limit to 3 recommendations
    return [...new Set(recommendations)].slice(0, 3);
}

// Entertainment preference detection
function detectEntertainmentPreferences(taskTexts) {
    const preferences = {
        types: [],
        genres: [],
        platforms: []
    };
    
    // Type detection
    const types = {
        movie: ['movie', 'film', 'cinema', 'watch movie'],
        series: ['series', 'show', 'tv', 'television', 'binge', 'episode'],
        game: ['game', 'play game', 'video game', 'gaming', 'console'],
        music: ['music', 'song', 'album', 'concert', 'playlist', 'artist']
    };
    
    for (const [type, keywords] of Object.entries(types)) {
        if (taskTexts.some(text => keywords.some(keyword => text.includes(keyword)))) {
            preferences.types.push(type);
        }
    }
    
    // Genre detection
    const genres = {
        action: ['action', 'adventure', 'thriller', 'exciting'],
        comedy: ['comedy', 'funny', 'humor', 'laugh'],
        drama: ['drama', 'emotional', 'serious', 'deep'],
        horror: ['horror', 'scary', 'frightening', 'terrifying'],
        documentary: ['documentary', 'documentary', 'real', 'factual', 'educational']
    };
    
    for (const [genre, keywords] of Object.entries(genres)) {
        if (taskTexts.some(text => keywords.some(keyword => text.includes(keyword)))) {
            preferences.genres.push(genre);
        }
    }
    
    // Platform detection
    const platforms = {
        netflix: ['netflix', 'streaming'],
        amazon: ['amazon', 'prime'],
        hulu: ['hulu'],
        disney: ['disney', 'disney+'],
        hbo: ['hbo', 'hbo max'],
        youtube: ['youtube', 'youtube premium']
    };
    
    for (const [platform, keywords] of Object.entries(platforms)) {
        if (taskTexts.some(text => keywords.some(keyword => text.includes(keyword)))) {
            preferences.platforms.push(platform);
        }
    }
    
    return preferences;
}

// Get entertainment recommendations
function getEntertainmentRecommendations(preferences) {
    const recommendations = [];
    
    // If no specific preferences, provide general recommendations
    if (preferences.types.length === 0 && preferences.genres.length === 0) {
        return [
            "Breaking Bad (TV Series)",
            "Inception (Movie)",
            "The Last of Us (Game)"
        ];
    }
    
    // Type-based recommendations
    if (preferences.types.includes('movie')) {
        if (preferences.genres.includes('action')) {
            recommendations.push("Mad Max: Fury Road");
            recommendations.push("John Wick");
        } else if (preferences.genres.includes('comedy')) {
            recommendations.push("The Hangover");
            recommendations.push("Superbad");
        } else if (preferences.genres.includes('drama')) {
            recommendations.push("The Shawshank Redemption");
            recommendations.push("The Godfather");
        } else if (preferences.genres.includes('horror')) {
            recommendations.push("Get Out");
            recommendations.push("A Quiet Place");
        } else {
            recommendations.push("Inception");
            recommendations.push("The Dark Knight");
        }
    }
    
    if (preferences.types.includes('series')) {
        if (preferences.genres.includes('drama')) {
            recommendations.push("Breaking Bad");
            recommendations.push("The Wire");
        } else if (preferences.genres.includes('comedy')) {
            recommendations.push("The Office");
            recommendations.push("Parks and Recreation");
        } else if (preferences.genres.includes('action')) {
            recommendations.push("Game of Thrones");
            recommendations.push("The Boys");
        } else {
            recommendations.push("Stranger Things");
            recommendations.push("The Crown");
        }
    }
    
    if (preferences.types.includes('game')) {
        recommendations.push("The Last of Us");
        recommendations.push("Red Dead Redemption 2");
        recommendations.push("God of War");
    }
    
    if (preferences.types.includes('music')) {
        recommendations.push("Spotify Premium for ad-free listening");
        recommendations.push("Apple Music for high-quality streaming");
    }
    
    // Platform-based recommendations
    if (preferences.platforms.includes('netflix')) {
        recommendations.push("Netflix Original: The Witcher");
        recommendations.push("Netflix Original: Money Heist");
    }
    
    if (preferences.platforms.includes('amazon')) {
        recommendations.push("Amazon Original: The Boys");
        recommendations.push("Amazon Original: The Marvelous Mrs. Maisel");
    }
    
    // Remove duplicates and limit to 3 recommendations
    return [...new Set(recommendations)].slice(0, 3);
}

// Travel preference detection
function detectTravelPreferences(taskTexts) {
    const preferences = {
        destinations: [],
        activities: [],
        budget: 'medium',
        duration: 'medium'
    };
    
    // Destination detection
    const destinations = {
        beach: ['beach', 'ocean', 'sea', 'coast', 'tropical', 'island'],
        mountain: ['mountain', 'hiking', 'trail', 'summit', 'peak', 'alpine'],
        city: ['city', 'urban', 'metropolis', 'downtown', 'skyline'],
        countryside: ['countryside', 'rural', 'farm', 'village', 'country'],
        international: ['international', 'abroad', 'foreign', 'overseas', 'trip abroad']
    };
    
    for (const [destination, keywords] of Object.entries(destinations)) {
        if (taskTexts.some(text => keywords.some(keyword => text.includes(keyword)))) {
            preferences.destinations.push(destination);
        }
    }
    
    // Activity detection
    const activities = {
        relaxation: ['relax', 'rest', 'unwind', 'chill', 'leisure'],
        adventure: ['adventure', 'exciting', 'thrill', 'extreme', 'challenge'],
        culture: ['culture', 'museum', 'art', 'history', 'heritage', 'traditional'],
        food: ['food', 'cuisine', 'restaurant', 'dining', 'culinary', 'gastronomy']
    };
    
    for (const [activity, keywords] of Object.entries(activities)) {
        if (taskTexts.some(text => keywords.some(keyword => text.includes(keyword)))) {
            preferences.activities.push(activity);
        }
    }
    
    // Budget detection
    if (taskTexts.some(text => text.includes('budget') || text.includes('cheap') || text.includes('affordable'))) {
        preferences.budget = 'low';
    } else if (taskTexts.some(text => text.includes('luxury') || text.includes('expensive') || text.includes('high-end'))) {
        preferences.budget = 'high';
    }
    
    // Duration detection
    if (taskTexts.some(text => text.includes('short') || text.includes('weekend') || text.includes('day trip'))) {
        preferences.duration = 'short';
    } else if (taskTexts.some(text => text.includes('long') || text.includes('extended') || text.includes('month'))) {
        preferences.duration = 'long';
    }
    
    return preferences;
}

// Get travel recommendations
function getTravelRecommendations(preferences) {
    const recommendations = [];
    
    // If no specific preferences, provide general recommendations
    if (preferences.destinations.length === 0 && preferences.activities.length === 0) {
        return [
            "Weekend getaway to a nearby city",
            "Day trip to a local attraction",
            "Staycation with new activities"
        ];
    }
    
    // Destination-based recommendations
    if (preferences.destinations.includes('beach')) {
        if (preferences.budget === 'low') {
            recommendations.push("Local beach day trip");
        } else if (preferences.budget === 'high') {
            recommendations.push("Luxury resort in the Maldives");
        } else {
            recommendations.push("Beach vacation in Florida or California");
        }
    }
    
    if (preferences.destinations.includes('mountain')) {
        if (preferences.activities.includes('adventure')) {
            recommendations.push("Hiking trip to national parks");
        } else {
            recommendations.push("Mountain retreat with scenic views");
        }
    }
    
    if (preferences.destinations.includes('city')) {
        if (preferences.activities.includes('culture')) {
            recommendations.push("Cultural city break to museums and galleries");
        } else {
            recommendations.push("Urban exploration in a vibrant city");
        }
    }
    
    if (preferences.destinations.includes('countryside')) {
        recommendations.push("Rural escape to a countryside cottage");
    }
    
    if (preferences.destinations.includes('international')) {
        if (preferences.budget === 'low') {
            recommendations.push("Budget-friendly international destination like Thailand or Portugal");
        } else if (preferences.budget === 'high') {
            recommendations.push("Luxury international trip to Japan or Switzerland");
        } else {
            recommendations.push("International trip to popular destinations like Italy or Spain");
        }
    }
    
    // Activity-based recommendations
    if (preferences.activities.includes('relaxation')) {
        recommendations.push("Spa weekend getaway");
        recommendations.push("Relaxing beach vacation");
    }
    
    if (preferences.activities.includes('adventure')) {
        recommendations.push("Adventure sports destination");
        recommendations.push("Wilderness exploration trip");
    }
    
    if (preferences.activities.includes('culture')) {
        recommendations.push("Cultural heritage tour");
        recommendations.push("Art and history focused trip");
    }
    
    if (preferences.activities.includes('food')) {
        recommendations.push("Culinary tour to a food destination");
        recommendations.push("Wine tasting trip");
    }
    
    // Duration-based recommendations
    if (preferences.duration === 'short') {
        recommendations.push("Weekend getaway to a nearby destination");
    } else if (preferences.duration === 'long') {
        recommendations.push("Extended vacation to multiple destinations");
    }
    
    // Remove duplicates and limit to 3 recommendations
    return [...new Set(recommendations)].slice(0, 3);
}

// Get study topic recommendations
function getStudyTopicRecommendations(topic) {
    const recommendations = {
        'deep learning': {
            prerequisites: [
                'Linear Algebra fundamentals',
                'Python programming',
                'Basic statistics and probability'
            ],
            startingPoints: [
                'Neural Networks basics',
                'TensorFlow or PyTorch frameworks',
                'Supervised Learning concepts'
            ],
            resources: [
                'Coursera Deep Learning Specialization',
                'Fast.ai course',
                'Deep Learning book by Ian Goodfellow'
            ],
            projects: [
                'Image classification project',
                'Natural Language Processing task',
                'Simple neural network implementation'
            ]
        },
        'machine learning': {
            prerequisites: [
                'Statistics and Probability',
                'Python programming',
                'Basic calculus'
            ],
            startingPoints: [
                'Supervised vs Unsupervised Learning',
                'Basic algorithms (Linear Regression, Decision Trees)',
                'Scikit-learn library'
            ],
            resources: [
                'Andrew Ng\'s Machine Learning course',
                'Python Machine Learning by Sebastian Raschka',
                'Kaggle tutorials'
            ],
            projects: [
                'Data classification project',
                'Regression analysis',
                'Clustering exercise'
            ]
        },
        'web development': {
            prerequisites: [
                'HTML and CSS basics',
                'JavaScript fundamentals',
                'Basic command line usage'
            ],
            startingPoints: [
                'Frontend basics (HTML, CSS, JavaScript)',
                'Responsive design principles',
                'Basic backend concepts'
            ],
            resources: [
                'freeCodeCamp curriculum',
                'MDN Web Docs',
                'The Odin Project'
            ],
            projects: [
                'Personal portfolio website',
                'Simple todo application',
                'Responsive landing page'
            ]
        }
    };

    // Add study topic detection to analyzeTask function
    if (recommendations[topic.toLowerCase()]) {
        const rec = recommendations[topic.toLowerCase()];
        return {
            type: 'study',
            message: `Here's your learning path for ${topic}:\n` +
                    `Prerequisites: ${rec.prerequisites.join(', ')}\n` +
                    `Start with: ${rec.startingPoints.join(', ')}\n` +
                    `Recommended resources: ${rec.resources.join(', ')}\n` +
                    `Practice projects: ${rec.projects.join(', ')}`
        };
    }
    return null;
}

// Get specific travel recommendations
function getSpecificTravelRecommendations(destination) {
    const recommendations = {
        'kerala beaches': {
            destinations: [
                'Varkala Beach - Known for cliff-side views and water sports',
                'Kovalam Beach - Perfect for sunbathing and ayurvedic treatments',
                'Marari Beach - Quiet and pristine with fewer tourists',
                'Bekal Beach - Historic fort and golden sands'
            ],
            bestTimeToVisit: 'October to February (avoiding monsoon season)',
            activities: [
                'Ayurvedic spa treatments',
                'Water sports at Kovalam',
                'Sunset watching at Varkala cliff',
                'Fresh seafood dining',
                'Houseboat tours in nearby backwaters'
            ],
            accommodation: [
                'Luxury beach resorts',
                'Boutique heritage hotels',
                'Beachside cottages',
                'Homestays with local families'
            ],
            tips: [
                'Book accommodations in advance during peak season',
                'Respect local customs and dress modestly',
                'Try local Kerala cuisine',
                'Combine beach visit with backwater tours'
            ]
        },
        'goa beaches': {
            destinations: [
                'Calangute Beach - Popular and lively',
                'Palolem Beach - Scenic and peaceful',
                'Baga Beach - Water sports and nightlife',
                'Anjuna Beach - Famous for flea markets'
            ],
            bestTimeToVisit: 'November to February',
            activities: [
                'Water sports and parasailing',
                'Beach shack dining',
                'Nightlife and parties',
                'Flea market shopping',
                'Old Goa church visits'
            ],
            accommodation: [
                'Beach resorts',
                'Budget hostels',
                'Beach huts',
                'Luxury hotels'
            ],
            tips: [
                'Book in advance for peak season',
                'Rent a scooter for easy travel',
                'Visit during off-peak for better rates',
                'Try local Goan cuisine'
            ]
        }
    };

    // Add more destinations as needed
    if (recommendations[destination.toLowerCase()]) {
        const rec = recommendations[destination.toLowerCase()];
        return {
            type: 'travel',
            message: `Travel Guide for ${destination}:\n` +
                    `Best Time to Visit: ${rec.bestTimeToVisit}\n` +
                    `Top Destinations: ${rec.destinations.join(', ')}\n` +
                    `Recommended Activities: ${rec.activities.join(', ')}\n` +
                    `Accommodation Options: ${rec.accommodation.join(', ')}\n` +
                    `Travel Tips: ${rec.tips.join(', ')}`
        };
    }
    return null;
}

// Update analyzeTask function to include specific travel recommendations
async function analyzeTask(index, text) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const lowerText = text.toLowerCase();
    let category = "General";
    let recommendation = "";

    // Check for specific travel destinations
    if (lowerText.includes('beach') || lowerText.includes('visit') || lowerText.includes('travel')) {
        for (const destination of ['kerala beaches', 'goa beaches']) {
            if (lowerText.includes(destination.split(' ')[0].toLowerCase())) {
                const travelRec = getSpecificTravelRecommendations(destination);
                if (travelRec) {
                    category = "Travel";
                    recommendation = travelRec.message;
                }
            }
        }
    }

    // Check for study-related tasks
    if (lowerText.includes('study') || lowerText.includes('learn') || lowerText.includes('start')) {
        for (const topic of ['deep learning', 'machine learning', 'web development']) {
            if (lowerText.includes(topic)) {
                const studyRec = getStudyTopicRecommendations(topic);
                if (studyRec) {
                    category = "Study";
                    recommendation = studyRec.message;
                }
            }
        }
    }

    // Enhanced category detection
    if (lowerText.includes('work') || lowerText.includes('meeting') || lowerText.includes('project')) {
        category = "Work";
        recommendation = "Consider setting up reminders for this work task.";
    } else if (lowerText.includes('health')) {
        category = "Health";
        recommendation = "Remember to track your progress on this health goal.";
    } else if (lowerText.includes('shopping') || lowerText.includes('home') || lowerText.includes('personal')) {
        category = "Personal";
        recommendation = "Add any related personal tasks you might need to complete alongside this.";
    } else if (lowerText.includes('read') || lowerText.includes('book') || lowerText.includes('novel')) {
        category = "Reading";
        const readingPreferences = detectReadingPreferences([lowerText]);
        const bookRecommendations = getBookRecommendations(readingPreferences);
        recommendation = `Based on your interest in reading, I recommend: ${bookRecommendations.join(', ')}`;
    } else if (lowerText.includes('movie') || lowerText.includes('film') || lowerText.includes('watch')) {
        category = "Entertainment";
        const entertainmentPreferences = detectEntertainmentPreferences([lowerText]);
        const entertainmentRecommendations = getEntertainmentRecommendations(entertainmentPreferences);
        recommendation = `For entertainment, you might enjoy: ${entertainmentRecommendations.join(', ')}`;
    } else if (lowerText.includes('travel') || lowerText.includes('trip') || lowerText.includes('vacation')) {
        category = "Travel";
        const travelPreferences = detectTravelPreferences([lowerText]);
        const travelRecommendations = getTravelRecommendations(travelPreferences);
        recommendation = `For your travel plans, consider: ${travelRecommendations.join(', ')}`;
    }

    // Add priority-based recommendations
    const priority = tasks[index].priority || "low";
    switch(priority) {
        case 'high':
            recommendation = "This is a high-priority task! " + recommendation;
            break;
        case 'medium':
            recommendation = "This is a medium-priority task. " + recommendation;
            break;
        case 'low':
            recommendation = "This is a lower-priority task. " + recommendation;
            break;
    }

    tasks[index].category = category;
    tasks[index].aiRecommendation = recommendation;
    renderTasks();
}

function renderTasks() {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';
    
    // Hide AI summary by default - only show when button is clicked
    const aiSummary = document.getElementById('aiSummary');
    aiSummary.style.display = 'none';

    let filteredTasks = tasks;
    switch(currentView) {
        case 'my-day':
            filteredTasks = tasks.filter(t => t.myDay);
            break;
        case 'important':
            filteredTasks = tasks.filter(t => t.important);
            break;
        case 'planned':
            filteredTasks = tasks.filter(t => t.dueDate);
            break;
        case 'tasks':
            // For general tasks view, exclude tasks that are marked for "My Day"
            filteredTasks = tasks.filter(t => !t.myDay);
            break;
    }

    const searchText = document.getElementById('searchInput').value.toLowerCase();
    const filterStatus = document.getElementById('filterStatus').value;

    filteredTasks = filteredTasks.filter(task => 
        task.text.toLowerCase().includes(searchText) ||
        (task.tags && task.tags.some(tag => tag.toLowerCase().includes(searchText)))
    );

    if (filterStatus === 'completed') filteredTasks = filteredTasks.filter(t => t.completed);
    if (filterStatus === 'incomplete') filteredTasks = filteredTasks.filter(t => !t.completed);

    filteredTasks.forEach(task => {
        const li = document.createElement('li');
        li.className = 'task-item';
        li.innerHTML = `
            <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="toggleTask('${task._id}')"></div>
            <div class="task-content">
                <div class="task-text ${task.completed ? 'completed' : ''}">
                    ${task.text}
                    <span class="priority-badge priority-${task.priority}">${task.priority}</span>
                    ${task.category ? `<span class="category-tag category-${task.category.toLowerCase()}">${task.category}</span>` : ''}
                </div>
                <div class="task-meta">
                    ${task.dueDate ? `<span><i class="far fa-calendar"></i> ${new Date(task.dueDate).toLocaleDateString()}</span>` : ''}
                    ${task.tags && task.tags.length > 0 ? `<span><i class="fas fa-tags"></i> ${task.tags.join(', ')}</span>` : ''}
                    ${task.aiRecommendation ? `<div class="ai-recommendation"><i class="fas fa-lightbulb"></i> ${task.aiRecommendation}</div>` : ''}
                </div>
            </div>
            <div class="task-indicators">
                ${task.important ? '<div class="task-indicator indicator-important" title="Important"></div>' : ''}
                ${task.myDay ? '<div class="task-indicator indicator-my-day" title="My Day"></div>' : ''}
            </div>
            <div class="task-actions">
                <button class="task-action-btn" onclick="toggleImportant('${task._id}')" title="${task.important ? 'Remove from Important' : 'Mark as Important'}">
                    <i class="fas fa-star ${task.important ? 'text-warning' : ''}"></i>
                </button>
                <button class="task-action-btn" onclick="toggleMyDay('${task._id}')" title="${task.myDay ? 'Remove from My Day' : 'Add to My Day'}">
                    <i class="fas fa-sun ${task.myDay ? 'text-warning' : ''}"></i>
                </button>
                <button class="task-action-btn" onclick="deleteTask('${task._id}')" title="Delete Task">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        taskList.appendChild(li);
    });
}

// Event Listeners
document.getElementById('addTaskBtn').addEventListener('click', addTask);
document.getElementById('taskInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask();
});

// Search functionality
document.getElementById('searchInput').addEventListener('input', () => {
    renderTasks();
});

// Filter functionality
document.getElementById('filterStatus').addEventListener('change', () => {
    renderTasks();
});

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded - Starting initialization');
    
    // Clear any stored authentication data to force login
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    token = null;
    currentUser = null;
    
    console.log('Cleared localStorage and reset variables');
    
    // Always show login page first - with a small delay to ensure it takes effect
    setTimeout(() => {
        showContainer('loginContainer');
        console.log('Showing login container after delay');
    }, 100);
    
    // If you want to auto-login later, uncomment this:
    /*
    token = localStorage.getItem('token');
    currentUser = JSON.parse(localStorage.getItem('user')) || null;
    if (token && currentUser) {
        await fetchTasks();
        showContainer('appContainer');
        document.getElementById('userDisplay').innerHTML = `👤 <b>${currentUser.username}</b>`;
        renderTasks();
        updateAIRecommendations();
    } else {
        showContainer('loginContainer');
    }
    */
});

// Reminders with browser notifications
function scheduleReminder(task) {
    if (task.reminder && "Notification" in window) {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                const now = new Date();
                const due = new Date(task.dueDate || now);
                const [remHour, remMin] = task.reminder.split(':');
                due.setHours(remHour, remMin, 0, 0);
                const timeout = due - now;
                if (timeout > 0) {
                    setTimeout(() => {
                        new Notification("Task Reminder", { body: task.text });
                    }, timeout);
                }
            }
        });
    }
}

// Dark mode toggle
document.getElementById('toggleDarkMode').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
});

// Export tasks
document.getElementById('exportBtn').addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "tasks.json");
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
});

// Import tasks
document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importInput').click();
});
document.getElementById('importInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const imported = JSON.parse(evt.target.result);
            if (Array.isArray(imported)) {
                tasks = imported;
                saveTasks();
                renderTasks();
            }
        } catch (err) {
            alert("Invalid file format.");
        }
    };
    reader.readAsText(file);
});

// Get AI Recommendations button
document.getElementById('aiRecommendBtn').addEventListener('click', () => {
    const aiSummary = document.getElementById('aiSummary');
    aiSummary.style.display = 'block';
    generateTaskRecommendations();
    aiSummary.scrollIntoView({ behavior: 'smooth' });
});

// Enhanced AI Task Recommendations based on previous tasks
function generateTaskRecommendations() {
    if (!tasks || tasks.length === 0) {
        document.getElementById('aiSummary').innerHTML = `
            <div class="ai-summary">
                <h3><i class="fas fa-lightbulb"></i> AI Task Recommendations</h3>
                <p>No tasks found. Start adding tasks to get personalized recommendations!</p>
            </div>
        `;
        return;
    }

    const recommendations = analyzeTaskPatterns();
    const suggestedTasks = generateSuggestedTasks(recommendations);
    
    document.getElementById('aiSummary').innerHTML = `
        <div class="ai-summary">
            <h3><i class="fas fa-lightbulb"></i> AI Task Recommendations</h3>
            <div class="recommendations-container">
                <div class="pattern-analysis">
                    <h4><i class="fas fa-chart-line"></i> Your Task Patterns</h4>
                    <ul>
                        ${recommendations.patterns.map(pattern => `<li>${pattern}</li>`).join('')}
                    </ul>
                </div>
                <div class="suggested-tasks">
                    <h4><i class="fas fa-plus-circle"></i> Suggested Tasks</h4>
                    <div class="suggested-tasks-list">
                        ${suggestedTasks.map(task => `
                            <div class="suggested-task-item">
                                <span class="suggested-task-text">${task.text}</span>
                                <div class="suggested-task-actions">
                                    <button class="add-suggested-task-btn" onclick="addSuggestedTask('${task.text}', '${task.priority}', '${task.category}')">
                                        <i class="fas fa-plus"></i> Add
                                    </button>
                                    <span class="suggested-task-reason">${task.reason}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function analyzeTaskPatterns() {
    const patterns = [];
    const completedTasks = tasks.filter(t => t.completed);
    const incompleteTasks = tasks.filter(t => !t.completed);
    
    // Analyze completion patterns
    if (completedTasks.length > 0) {
        const completionRate = (completedTasks.length / tasks.length * 100).toFixed(1);
        patterns.push(`You've completed ${completionRate}% of your tasks`);
    }
    
    // Analyze priority patterns
    const priorityCounts = tasks.reduce((acc, task) => {
        acc[task.priority] = (acc[task.priority] || 0) + 1;
        return acc;
    }, {});
    
    if (priorityCounts.high > 0) {
        patterns.push(`You have ${priorityCounts.high} high-priority tasks`);
    }
    
    // Analyze time patterns
    const tasksWithDates = tasks.filter(t => t.dueDate);
    if (tasksWithDates.length > 0) {
        const overdueTasks = tasksWithDates.filter(t => new Date(t.dueDate) < new Date() && !t.completed);
        if (overdueTasks.length > 0) {
            patterns.push(`You have ${overdueTasks.length} overdue tasks`);
        }
    }
    
    // Analyze category patterns
    const categoryCounts = tasks.reduce((acc, task) => {
        const category = task.category || 'General';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
    }, {});
    
    const topCategories = Object.entries(categoryCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);
    
    if (topCategories.length > 0) {
        patterns.push(`Your top categories: ${topCategories.map(([cat, count]) => `${cat} (${count})`).join(', ')}`);
    }
    
    // Analyze recurring patterns
    const recurringTasks = tasks.filter(t => t.recurring);
    if (recurringTasks.length > 0) {
        patterns.push(`You have ${recurringTasks.length} recurring tasks`);
    }
    
    // Analyze content patterns
    const taskTexts = tasks.map(t => t.text.toLowerCase());
    const contentPatterns = analyzeContentPatterns(taskTexts);
    patterns.push(...contentPatterns);
    
    return { patterns };
}

function analyzeContentPatterns(taskTexts) {
    const patterns = [];
    const allWords = taskTexts.join(' ').split(/\s+/).filter(word => word.length > 3);
    
    // Reading patterns
    const readingWords = allWords.filter(word => ['read', 'reading', 'book', 'novel', 'story', 'chapter'].includes(word));
    if (readingWords.length > 0) {
        patterns.push(`You're actively reading (${readingWords.length} reading-related tasks)`);
    }
    
    // Study patterns
    const studyWords = allWords.filter(word => ['study', 'learn', 'course', 'class', 'assignment', 'homework', 'exam'].includes(word));
    if (studyWords.length > 0) {
        patterns.push(`You're focused on learning (${studyWords.length} study-related tasks)`);
    }
    
    // Work patterns
    const workWords = allWords.filter(word => ['meeting', 'project', 'report', 'email', 'presentation', 'deadline'].includes(word));
    if (workWords.length > 0) {
        patterns.push(`You have work commitments (${workWords.length} work-related tasks)`);
    }
    
    // Health patterns
    const healthWords = allWords.filter(word => ['exercise', 'workout', 'gym', 'run', 'walk', 'yoga', 'meditation'].includes(word));
    if (healthWords.length > 0) {
        patterns.push(`You prioritize health (${healthWords.length} fitness-related tasks)`);
    }
    
    // Social patterns
    const socialWords = allWords.filter(word => ['meet', 'party', 'dinner', 'lunch', 'coffee', 'friend', 'family'].includes(word));
    if (socialWords.length > 0) {
        patterns.push(`You maintain social connections (${socialWords.length} social activities)`);
    }
    
    return patterns;
}

function generateSuggestedTasks(recommendations) {
    const suggestedTasks = [];
    
    // Get task categories and common patterns
    const taskTexts = tasks.map(t => t.text.toLowerCase());
    const categories = tasks.map(t => t.category || 'General');
    const commonWords = getCommonWords(taskTexts);
    
    // Generate content-based suggestions
    const contentSuggestions = generateContentBasedSuggestions(taskTexts, commonWords);
    suggestedTasks.push(...contentSuggestions);
    
    // Generate category-based suggestions
    const categorySuggestions = generateCategorySuggestions(categories, commonWords);
    suggestedTasks.push(...categorySuggestions);
    
    // Generate time-based suggestions
    const timeSuggestions = generateTimeBasedSuggestions();
    suggestedTasks.push(...timeSuggestions);
    
    // Generate productivity suggestions
    const productivitySuggestions = generateProductivitySuggestions();
    suggestedTasks.push(...productivitySuggestions);
    
    return suggestedTasks.slice(0, 10); // Increased limit to 10 suggestions
}

function getCommonWords(taskTexts) {
    const words = taskTexts.join(' ').split(/\s+/);
    const wordCount = {};
    words.forEach(word => {
        if (word.length > 3) { // Only count words longer than 3 characters
            wordCount[word] = (wordCount[word] || 0) + 1;
        }
    });
    return Object.entries(wordCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([word]) => word);
}

function generateContentBasedSuggestions(taskTexts, commonWords) {
    const suggestions = [];
    
    // Analyze each task for specific content patterns
    taskTexts.forEach(taskText => {
        const words = taskText.split(' ');
        
        // Reading-related suggestions
        if (words.some(word => ['read', 'reading', 'book', 'novel', 'story', 'chapter'].includes(word))) {
            suggestions.push({
                text: 'Buy new books for your reading list',
                priority: 'medium',
                category: 'Personal',
                reason: 'Based on your reading activities'
            });
            suggestions.push({
                text: 'Join a book club or reading group',
                priority: 'low',
                category: 'Social',
                reason: 'Enhance your reading experience'
            });
            suggestions.push({
                text: 'Create a reading log or book journal',
                priority: 'low',
                category: 'Personal',
                reason: 'Track your reading progress'
            });
        }
        
        // Study/learning suggestions
        if (words.some(word => ['study', 'learn', 'course', 'class', 'assignment', 'homework', 'exam'].includes(word))) {
            suggestions.push({
                text: 'Review and organize study materials',
                priority: 'medium',
                category: 'Study',
                reason: 'Based on your learning activities'
            });
            suggestions.push({
                text: 'Schedule study breaks and review sessions',
                priority: 'medium',
                category: 'Study',
                reason: 'Optimize your learning routine'
            });
        }
        
        // Work-related suggestions
        if (words.some(word => ['meeting', 'project', 'report', 'email', 'presentation', 'deadline'].includes(word))) {
            suggestions.push({
                text: 'Prepare agenda for upcoming meetings',
                priority: 'medium',
                category: 'Work',
                reason: 'Based on your work activities'
            });
            suggestions.push({
                text: 'Update project documentation',
                priority: 'medium',
                category: 'Work',
                reason: 'Maintain project organization'
            });
        }
        
        // Health/fitness suggestions
        if (words.some(word => ['exercise', 'workout', 'gym', 'run', 'walk', 'yoga', 'meditation'].includes(word))) {
            suggestions.push({
                text: 'Plan your weekly workout schedule',
                priority: 'high',
                category: 'Health',
                reason: 'Based on your fitness activities'
            });
            suggestions.push({
                text: 'Prepare healthy meals for the week',
                priority: 'medium',
                category: 'Health',
                reason: 'Support your fitness goals'
            });
        }
        
        // Travel suggestions
        if (words.some(word => ['travel', 'trip', 'vacation', 'flight', 'hotel', 'booking'].includes(word))) {
            suggestions.push({
                text: 'Research travel destinations and activities',
                priority: 'medium',
                category: 'Travel',
                reason: 'Based on your travel plans'
            });
            suggestions.push({
                text: 'Create a travel checklist and packing list',
                priority: 'medium',
                category: 'Travel',
                reason: 'Prepare for your trip'
            });
        }
        
        // Home/maintenance suggestions
        if (words.some(word => ['clean', 'organize', 'repair', 'maintenance', 'house', 'home'].includes(word))) {
            suggestions.push({
                text: 'Create a home maintenance schedule',
                priority: 'low',
                category: 'Personal',
                reason: 'Based on your home activities'
            });
            suggestions.push({
                text: 'Declutter and organize living spaces',
                priority: 'medium',
                category: 'Personal',
                reason: 'Maintain a clean environment'
            });
        }
        
        // Social suggestions
        if (words.some(word => ['meet', 'party', 'dinner', 'lunch', 'coffee', 'friend', 'family'].includes(word))) {
            suggestions.push({
                text: 'Plan social activities for the month',
                priority: 'low',
                category: 'Social',
                reason: 'Based on your social activities'
            });
            suggestions.push({
                text: 'Reach out to friends and family',
                priority: 'medium',
                category: 'Social',
                reason: 'Maintain relationships'
            });
        }
        
        // Technology suggestions
        if (words.some(word => ['computer', 'phone', 'app', 'software', 'update', 'backup'].includes(word))) {
            suggestions.push({
                text: 'Backup important files and data',
                priority: 'medium',
                category: 'Technology',
                reason: 'Based on your tech activities'
            });
            suggestions.push({
                text: 'Update software and security settings',
                priority: 'medium',
                category: 'Technology',
                reason: 'Maintain system security'
            });
        }
        
        // Financial suggestions
        if (words.some(word => ['budget', 'expense', 'bill', 'payment', 'money', 'finance'].includes(word))) {
            suggestions.push({
                text: 'Review and update monthly budget',
                priority: 'high',
                category: 'Finance',
                reason: 'Based on your financial activities'
            });
            suggestions.push({
                text: 'Track expenses and create financial goals',
                priority: 'medium',
                category: 'Finance',
                reason: 'Improve financial management'
            });
        }
    });
    
    // Remove duplicates based on text
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) => 
        index === self.findIndex(s => s.text === suggestion.text)
    );
    
    return uniqueSuggestions;
}

function generateCategorySuggestions(categories, commonWords) {
    const suggestions = [];
    const categoryCounts = categories.reduce((acc, cat) => {
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
    }, {});
    
    // Work-related suggestions
    if (categoryCounts['Work'] > 0 || commonWords.some(w => ['meeting', 'project', 'report', 'email'].includes(w))) {
        suggestions.push({
            text: 'Review weekly goals and plan next week',
            priority: 'medium',
            category: 'Work',
            reason: 'Based on your work task patterns'
        });
        suggestions.push({
            text: 'Organize email inbox and respond to pending messages',
            priority: 'medium',
            category: 'Work',
            reason: 'Common work activity'
        });
    }
    
    // Health-related suggestions
    if (categoryCounts['Health'] > 0 || commonWords.some(w => ['exercise', 'workout', 'gym', 'run'].includes(w))) {
        suggestions.push({
            text: 'Schedule workout session for this week',
            priority: 'high',
            category: 'Health',
            reason: 'Based on your health and fitness patterns'
        });
    }
    
    // Study-related suggestions
    if (categoryCounts['Study'] > 0 || commonWords.some(w => ['study', 'read', 'learn', 'course'].includes(w))) {
        suggestions.push({
            text: 'Review and update study notes',
            priority: 'medium',
            category: 'Study',
            reason: 'Based on your learning patterns'
        });
    }
    
    return suggestions;
}

function generateTimeBasedSuggestions() {
    const suggestions = [];
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    // Weekend suggestions
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        suggestions.push({
            text: 'Plan meals for the upcoming week',
            priority: 'medium',
            category: 'Personal',
            reason: 'Weekend planning activity'
        });
        suggestions.push({
            text: 'Clean and organize living space',
            priority: 'low',
            category: 'Personal',
            reason: 'Weekend maintenance task'
        });
    }
    
    // Monday suggestions
    if (dayOfWeek === 1) {
        suggestions.push({
            text: 'Set weekly goals and priorities',
            priority: 'high',
            category: 'Planning',
            reason: 'Start of week planning'
        });
    }
    
    // End of week suggestions
    if (dayOfWeek === 5) {
        suggestions.push({
            text: 'Review and complete pending tasks',
            priority: 'high',
            category: 'Work',
            reason: 'End of week wrap-up'
        });
    }
    
    return suggestions;
}

function generateProductivitySuggestions() {
    const suggestions = [];
    
    // Check for incomplete high-priority tasks
    const incompleteHighPriority = tasks.filter(t => !t.completed && t.priority === 'high');
    if (incompleteHighPriority.length > 0) {
        suggestions.push({
            text: 'Focus on completing high-priority tasks first',
            priority: 'high',
            category: 'Planning',
            reason: `You have ${incompleteHighPriority.length} incomplete high-priority tasks`
        });
    }
    
    // Check for overdue tasks
    const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && !t.completed);
    if (overdueTasks.length > 0) {
        suggestions.push({
            text: 'Address overdue tasks and update deadlines',
            priority: 'high',
            category: 'Planning',
            reason: `You have ${overdueTasks.length} overdue tasks`
        });
    }
    
    // General productivity suggestions
    suggestions.push({
        text: 'Take a 5-minute break and stretch',
        priority: 'low',
        category: 'Health',
        reason: 'Productivity and wellness break'
    });
    
    return suggestions;
}

// Function to add suggested tasks
function addSuggestedTask(text, priority, category) {
    document.getElementById('taskInput').value = text;
    document.getElementById('prioritySelect').value = priority;
    
    // Set flags based on current view
    let important = false;
    let myDay = false;
    
    switch(currentView) {
        case 'important':
            important = true;
            break;
        case 'my-day':
            myDay = true;
            break;
    }
    
    // Create the task object
    const task = {
        text: text,
        priority: priority,
        category: category,
        important: important,
        myDay: myDay,
        completed: false,
        createdAt: new Date().toISOString()
    };
    
    // Add the task
    addTask();
    
    // Show success message
    const successMsg = document.createElement('div');
    successMsg.className = 'success-message';
    successMsg.innerHTML = `<i class="fas fa-check"></i> Task "${text}" added successfully!`;
    successMsg.style.cssText = 'background: #4CAF50; color: white; padding: 10px; margin: 10px 0; border-radius: 5px; text-align: center;';
    
    const aiSummary = document.getElementById('aiSummary');
    aiSummary.insertBefore(successMsg, aiSummary.firstChild);
    
    // Remove success message after 3 seconds
    setTimeout(() => {
        if (successMsg.parentNode) {
            successMsg.remove();
        }
    }, 3000);
}

