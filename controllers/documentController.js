const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const db = require('../backend/configDB');

// Variables globales pour la connexion
let gateway;
let contract;

// Dossier de sauvegarde
const BACKUP_DIR = path.join(__dirname, '../backups');
const BACKUP_FILE = path.join(BACKUP_DIR, 'documents_backup.json');

// Assurer que le dossier backup existe
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// ==================== FONCTIONS DE SAUVEGARDE ====================

// Fonction de sauvegarde automatique
async function backupDocument(hash, owner, timestamp) {
    try {
        // Lire le backup existant
        let backups = [];
        if (fs.existsSync(BACKUP_FILE)) {
            const data = fs.readFileSync(BACKUP_FILE, 'utf8');
            backups = JSON.parse(data);
        }

        // Ajouter le nouveau document
        const newDocument = {
            hash: hash,
            owner: owner,
            timestamp: timestamp,
            backupDate: new Date().toISOString()
        };

        // Vérifier si le document existe déjà
        const existingIndex = backups.findIndex(doc => doc.hash === hash);
        if (existingIndex !== -1) {
            backups[existingIndex] = newDocument;
        } else {
            backups.push(newDocument);
        }

        // Sauvegarder
        fs.writeFileSync(BACKUP_FILE, JSON.stringify(backups, null, 2));
        console.log(`✅ Document sauvegardé: ${hash}`);

        // Sauvegarde supplémentaire avec timestamp
        const timestampBackup = path.join(BACKUP_DIR, `backup_${Date.now()}.json`);
        fs.writeFileSync(timestampBackup, JSON.stringify([newDocument], null, 2));

    } catch (error) {
        console.error('❌ Erreur sauvegarde:', error);
    }
}

// Fonction pour obtenir le contrat
const getContract = async () => {
    if (contract) return contract;
    await initializeGateway();
    return contract;
};

// Fonction pour vérifier l'existence d'un document
async function checkDocumentExists(hash) {
    try {
        const contract = await getContract();
        await contract.evaluateTransaction('ConsulterDocument', hash);
        return true;
    } catch (error) {
        return false;
    }
}

// Fonction pour obtenir les détails d'un document
async function getDocumentDetails(hash) {
    try {
        const contract = await getContract();
        const result = await contract.evaluateTransaction('ConsulterDocument', hash);
        return JSON.parse(result.toString());
    } catch (error) {
        return null;
    }
}

// Fonction pour enregistrer sur la blockchain
async function registerDocumentOnBlockchain(hash, owner, timestamp) {
    const contract = await getContract();
    await contract.submitTransaction('EnregistrerDocument', hash, owner, timestamp);
}

// Fonction de restauration automatique au démarrage
async function restoreBackupOnStartup() {
    try {
        if (!fs.existsSync(BACKUP_FILE)) {
            console.log('ℹ️  Aucun backup à restaurer');
            return;
        }

        const data = fs.readFileSync(BACKUP_FILE, 'utf8');
        const backups = JSON.parse(data);
        
        console.log(`🔄 Tentative de restauration de ${backups.length} documents...`);

        for (const doc of backups) {
            try {
                // Vérifier si le document existe déjà sur la blockchain
                const exists = await checkDocumentExists(doc.hash);
                if (!exists) {
                    await registerDocumentOnBlockchain(doc.hash, doc.owner, doc.timestamp);
                    console.log(`✅ Document restauré: ${doc.hash}`);
                } else {
                    console.log(`⚠️  Document déjà existant: ${doc.hash}`);
                }
            } catch (error) {
                console.log(`❌ Erreur avec document ${doc.hash}:`, error.message);
            }
        }

        console.log('🎉 Restauration terminée');
    } catch (error) {
        console.error('❌ Erreur restauration:', error);
    }
}

// ==================== CONNEXION FABRIC ====================

const initializeGateway = async () => {
    if (gateway) return;

    try {
        console.log('🔄 Initialisation de la connexion Fabric...');
        const ccpPath = path.resolve(__dirname, '../backend/connection', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        const walletPath = path.join(__dirname, '../backend/wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        
        const identity = await wallet.get('appUser');
        if (!identity) {
            throw new Error("Identité appUser non trouvée dans le wallet.");
        }

        gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'appUser',
            discovery: { enabled: true, asLocalhost: true }
        });

        const network = await gateway.getNetwork('mychannel');
        contract = network.getContract('doccc');
        
        console.log('✅ Connexion Hyperledger Fabric établie');
    } catch (error) {
        console.error('❌ Erreur initialisation Fabric:', error);
        throw error;
    }
};

// ==================== ROUTES CONTROLLER ====================

// POST /documents => enregistrer un document
const postDocument = async (req, res) => {
    const { hash } = req.body;

    if (!req.session.user) {
        return res.status(401).json({ error: 'Utilisateur non authentifié.' });
    }

    const owner = req.session.user.username;
    const now = new Date();

    const timestamp = now.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    console.log(`🚀 Tentative d'enregistrement - Hash: ${hash}, Owner: ${owner}`);

    try {
        // 1. Sauvegarder IMMÉDIATEMENT dans le backup
        await backupDocument(hash, owner, timestamp);

        // 2. Vérifier d'abord si le document existe déjà
        await initializeGateway();
        const existingDocument = await getDocumentDetails(hash);
        
        if (existingDocument) {
            console.log(`ℹ️  Document déjà enregistré: ${hash}`);
            
            // Sauvegarder dans MySQL (même si document existe)
            try {
                const sql = 'INSERT INTO documents (hash, owner, timestamp) VALUES (?, ?, ?)';
                db.execute(sql, [hash, owner, timestamp], (err, results) => {
                    if (err) {
                        console.log('ℹ️  Erreur MySQL non critique:', err.message);
                    } else {
                        console.log('✅ Enregistrement MySQL réussi!');
                    }
                });
            } catch (mysqlError) {
                console.log('ℹ️  Erreur MySQL non critique:', mysqlError.message);
            }
            
            // Retourner les informations du document existant
            return res.status(200).json({ 
                success: true,
                message: 'Document déjà enregistré dans la blockchain.',
                data: existingDocument,
                status: 'already_exists'
            });
        }

        // 3. Si le document n'existe pas, l'enregistrer sur la blockchain
        console.log('💾 Envoi de la transaction...');
        await contract.submitTransaction('EnregistrerDocument', hash, owner, timestamp);
        console.log('✅ Enregistrement blockchain réussi!');

        // 4. Sauvegarder dans MySQL
        try {
            const sql = 'INSERT INTO documents (hash, owner, timestamp) VALUES (?, ?, ?)';
            db.execute(sql, [hash, owner, timestamp], (err, results) => {
                if (err) {
                    console.log('ℹ️  Erreur MySQL non critique:', err.message);
                } else {
                    console.log('✅ Enregistrement MySQL réussi!');
                }
            });
        } catch (mysqlError) {
            console.log('ℹ️  Erreur MySQL non critique:', mysqlError.message);
        }
        
        // Retourner les informations du nouveau document
        const newDocument = {
            hash: hash,
            owner: owner,
            timestamp: timestamp
        };
        
        res.status(200).json({ 
            success: true,
            message: 'Document enregistré avec succès dans la blockchain.',
            data: newDocument,
            status: 'new_document'
        });

    } catch (error) {
        console.error('💥 Erreur lors de l\'enregistrement:', error);
        
        // Gérer les autres types d'erreurs
        res.status(500).json({ 
            success: false,
            error: `Erreur lors de l'enregistrement: ${error.message}` 
        });
    }
};

// GET /documents?hash=... => consulter un document
const getDocument = async (req, res) => {
    const { hash } = req.query;
    
    if (!hash) {
        return res.status(400).json({ error: 'Paramètre hash requis.' });
    }

    try {
        await initializeGateway();
        const result = await contract.evaluateTransaction('ConsulterDocument', hash);
        const documentData = JSON.parse(result.toString());
        
        res.status(200).json({
            success: true,
            data: documentData
        });
    } catch (error) {
        if (error.message.includes("aucun document trouve avec le hash") || 
            error.message.includes("Aucun document trouvé")) {
            return res.status(404).json({ 
                success: false,
                error: 'Document non trouvé avec ce hash.' 
            });
        }
        res.status(500).json({ 
            success: false,
            error: `Erreur lors de la consultation: ${error.message}` 
        });
    }
};

// GET /session => vérifier la session
const getSess = async (req, res) => {
    if (!req.session.user) {
        res.json({ connected: false });
    } else {
        res.json({ 
            connected: true,
            user: req.session.user 
        });
    }
};

// POST /api/documents/upload => upload et enregistrement de fichier
const uploadDocument = async (req, res) => {
    
    try {
        // Vérifier si un fichier a été uploadé
        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                error: 'Aucun fichier uploadé.' 
            });
        }

        const owner = "nihad";
        const file = req.file;
        const now = new Date();

        const timestamp = now.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        console.log(`📤 Fichier uploadé: ${file.originalname}, Taille: ${file.size} bytes`);

        // 1. Calculer le hash du fichier
        const crypto = require('crypto');
        const fileBuffer = fs.readFileSync(file.path);
        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        console.log(`🔐 Hash calculé: ${hash}`);

        // 2. Sauvegarder IMMÉDIATEMENT dans le backup
        await backupDocument(hash, owner, timestamp);

        // 3. Vérifier si le document existe déjà
        await initializeGateway();
        const existingDocument = await getDocumentDetails(hash);
        
        if (existingDocument) {
            console.log(`ℹ️  Document déjà enregistré: ${hash}`);
            
            // Nettoyer le fichier temporaire
            fs.unlinkSync(file.path);
            
            return res.status(200).json({ 
                success: true,
                message: 'Document déjà enregistré dans la blockchain.',
                data: {
                    ...existingDocument,
                    filename: file.originalname,
                    filesize: file.size
                },
                status: 'already_exists'
            });
        }

        // 4. Enregistrer sur la blockchain
        console.log('💾 Envoi de la transaction...');
        await contract.submitTransaction('EnregistrerDocument', hash, owner, timestamp);
        console.log('✅ Enregistrement blockchain réussi!');

        // 5. Sauvegarder dans MySQL
        try {
            const sql = 'INSERT INTO documents (hash, owner, timestamp, filename, filesize) VALUES (?, ?, ?, ?, ?)';
            db.execute(sql, [hash, owner, timestamp, file.originalname, file.size], (err, results) => {
                if (err) {
                    console.log('ℹ️  Erreur MySQL non critique:', err.message);
                } else {
                    console.log('✅ Enregistrement MySQL réussi!');
                }
            });
        } catch (mysqlError) {
            console.log('ℹ️  Erreur MySQL non critique:', mysqlError.message);
        }

        // 6. Nettoyer le fichier temporaire
        fs.unlinkSync(file.path);

        // 7. Retourner la réponse
        const newDocument = {
            hash: hash,
            owner: owner,
            timestamp: timestamp,
            filename: file.originalname,
            filesize: file.size
        };
        
        res.status(200).json({ 
            success: true,
            message: 'Document enregistré avec succès dans la blockchain.',
            data: newDocument,
            status: 'new_document'
        });

    } catch (error) {
        // Nettoyer le fichier temporaire en cas d'erreur
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        console.error('💥 Erreur lors de l\'upload:', error);
        res.status(500).json({ 
            success: false,
            error: `Erreur lors de l'enregistrement: ${error.message}` 
        });
    }
};





// ==================== EXPORTS ====================

module.exports = {
    post: postDocument,
     upload: uploadDocument,
    get: getDocument,
    getSess: getSess,
    restoreBackupOnStartup
};