const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

async function testChaincode() {
    try {
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

        console.log('✅ Connexion établie');

        // Test d'enregistrement
        const testHash = 'test_hash_' + Date.now();
        const testOwner = 'test_user';
        const testTimestamp = new Date().toISOString();

        console.log('Test d\'enregistrement...');
        try {
            const result = await contract.submitTransaction('EnregistrerDocument', testHash, testOwner, testTimestamp);
            console.log('✅ Enregistrement réussi:', result.toString());
        } catch (error) {
            console.error('❌ Erreur lors de l\'enregistrement:', error);
        }

        // Test de consultation
        console.log('Test de consultation...');
        try {
            const result = await contract.evaluateTransaction('ConsulterDocument', testHash);
            console.log('✅ Consultation réussie:', result.toString());
        } catch (error) {
            console.error('❌ Erreur lors de la consultation:', error);
        }

        await gateway.disconnect();
        
    } catch (error) {
        console.error('❌ Erreur générale:', error);
    }
}

testChaincode();