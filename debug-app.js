const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

async function debugApp() {
    try {
        // Utiliser les mêmes chemins que votre app
        const ccpPath = path.resolve(__dirname, './backend/connection', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        const walletPath = path.join(__dirname, './backend/wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        
        const identity = await wallet.get('appUser');
        if (!identity) {
            throw new Error("Identité appUser non trouvée dans le wallet.");
        }

        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'appUser',
            discovery: { enabled: true, asLocalhost: true }
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('doccc');

        console.log('✅ Connexion depuis app établie');

        // Test avec le même hash que votre frontend
        const testHash = '37a7cc4b6a02e34858bebb9dbea2497afc9267c93c795e9494e51a2b10bdb105';
        
        console.log('Test consultation...');
        try {
            const result = await contract.evaluateTransaction('ConsulterDocument', testHash);
            console.log('✅ Consultation réussie:', result.toString());
        } catch (error) {
            console.log('✅ Document non trouvé (normal):', error.message);
        }

        console.log('Test enregistrement...');
        try {
            const result = await contract.submitTransaction('EnregistrerDocument', testHash, 'test_user', new Date().toISOString());
            console.log('✅ Enregistrement réussi');
        } catch (error) {
            console.error('❌ Erreur enregistrement:', error);
        }

        await gateway.disconnect();
        
    } catch (error) {
        console.error('❌ Erreur générale:', error);
    }
}

debugApp();