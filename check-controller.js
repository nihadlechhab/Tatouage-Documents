const controller = require('./controllers/documentController');

console.log('=== Vérification du contrôleur documentController ===');

// Vérifier si la fonction consulterDocument existe
if (controller.consulterDocument) {
    console.log('✅ consulterDocument: EXISTS');
} else {
    console.log('❌ consulterDocument: MISSING');
}

// Vérifier si la fonction post existe
if (controller.post) {
    console.log('✅ post: EXISTS');
} else {
    console.log('❌ post: MISSING');
}

console.log('=== Vérification terminée ===');