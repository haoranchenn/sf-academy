import fastify from 'fastify'
import { createSSEManager, FastifyHttpAdapter } from '@soluzioni-futura/sse-manager'
import { DbManager } from './manager/dbManager'
import  dotenv  from 'dotenv';
import { Crypto } from './entity/crypto';
import { HtmlManager } from './ui/htmlManager';    
import { CryptoManager } from './manager/cryptoManager';
import { User } from './entity/user';
import { Status, Transaction, TransactionType } from './entity/transaction';
import { Wallet } from './entity/wallet';


const server = fastify({ logger: true })
// eslint-disable-next-line @typescript-eslint/no-require-imports
server.register(require('@fastify/formbody'))


void (async () => {

    dotenv.config({path : "../resources/.env"})

    const htmlManager = new HtmlManager()
    const cryptoManager = new CryptoManager()

    //init Crypto Data
    const dbManager = new DbManager()
    const cryptoList = await dbManager.getCryptoList();
    if(!cryptoList.rowCount || cryptoList.rowCount <= 0){
        dbManager.initCrypto()
    }

    //init user
    const user = new User({
        id : '1',
        name : "paolo", 
        balance : process.env.STARTING_BALANCE || 100000
    })

    setInterval(async() => {
        const resultToArchive  = await dbManager.getTransactionToArchive(user.id)
        const transactionToArchive = resultToArchive.rows.map( r => new Transaction(r))
        transactionToArchive.forEach(t => dbManager.archiveTransaction(t))
        dbManager.deleteProcessedTranscation(user.id)
        sendTransactionTable()


        const result  = await dbManager.getTransactionToProcess(user.id)
        const transactionList = result.rows.map( r => new Transaction(r))
        const resultWallet  = await dbManager.getUserWallet(user.id)
        const wallet = resultWallet.rows.map( r => new Wallet(r))
        const resultCrypto  = await dbManager.getCryptoList()
        const cryptoList = resultCrypto.rows.map( r => new Crypto(r))

        for(const t of transactionList){
            const transaction = cryptoManager.checkIfTransactionIsValid(t, wallet, user, cryptoList);
        
            if(transaction.status === Status.completed){
                const walletIndex = wallet.findIndex((x : Wallet) => x.cryptoId === t.cryptoId);
                const cryptoIndex = cryptoList.findIndex((x : Crypto) => x.id === t.cryptoId);
                
                if(transaction.type === TransactionType.sell){
                    if(walletIndex !== -1) {
                        wallet[walletIndex].quantity -= transaction.quantity;
                        dbManager.updateUserWallet(wallet[walletIndex]);
                    }
                    
                    user.balance = Math.round((user.balance + (t.quantity * t.price)) * 100) / 100;
                    
                    if(cryptoIndex !== -1) {
                        cryptoList[cryptoIndex].quantity += transaction.quantity;
                        dbManager.updateCryptoQuantity(cryptoList[cryptoIndex]);
                    }
                } else { 
                    if(cryptoIndex !== -1) {
                        cryptoList[cryptoIndex].quantity -= transaction.quantity;
                        dbManager.updateCryptoQuantity(cryptoList[cryptoIndex]);
                    }
        
                    user.balance = Math.round((user.balance - (t.quantity * t.price)) * 100) / 100;
        
                    if(walletIndex !== -1) {
                        wallet[walletIndex].quantity += transaction.quantity;
                        dbManager.updateUserWallet(wallet[walletIndex]);
                    } else {
                        dbManager.insertUserWallet(user.id, transaction.cryptoId, transaction.quantity);
                    }
                }
            }
        
            dbManager.updateTransactionQueue(transaction);
            sendNewBalance();
            sendUpdatedTransaction(transactionList);
            const resultNew  = await dbManager.getCryptoList();
            const newCryptoList = resultNew.rows.map( r => new Crypto(r))
            sendNewCryptoList(newCryptoList)
        }
        //console.log(transactionList)
        

        
    }, 5000)


    //SSE manager
    const sseManager = await createSSEManager({
        httpAdapter: new FastifyHttpAdapter()
    })

    const cryptoRoom = "crypto-room"
    const balanceRoom = "balance-room"
    const transactionRoom = "transactionRoom"

    //broadcast dei nuovi valori
    setInterval(async() => {
        const result  = await dbManager.getCryptoList();
        const cryptoList = result.rows.map( r => new Crypto(r))
        const updatedCrypto = cryptoManager.changeMarketValue(cryptoList)
        await sendNewCryptoList(updatedCrypto)
    }, 10000)

    async function sendNewCryptoList(cryptoList : Crypto[]){
        await sseManager.broadcast(cryptoRoom, { data: htmlManager.getCryptoTable(cryptoList)})
    }

    async function sendNewBalance(){
        await sseManager.broadcast(balanceRoom, { data: user.balance.toString() })
    }

    async function sendUpdatedTransaction(transactionList : Transaction[]){
        await sseManager.broadcast(transactionRoom, { data: htmlManager.getTransactionTable(transactionList) })
    }

    async function sendTransactionTable(){
        const resultT  = await dbManager.getTransactionToProcess(user.id)
        const transactionList = resultT.rows.map( r => new Transaction(r))
        sendUpdatedTransaction(transactionList)
        const result  = await dbManager.getCryptoList();
        const cryptoList = result.rows.map( r => new Crypto(r))
        return htmlManager.getTransactionForm(cryptoList)
    }


    //HTML api
    server.get('/', async (request, reply) => {
        const result  = await dbManager.getCryptoList();
        const cryptoList = result.rows.map( r => new Crypto(r))
        reply.type('text/html').send(htmlManager.getMainpage(cryptoList, user))
    }) 


    server.get("/crypto-list", async(req, res) => {
        const sseStream = await sseManager.createSSEStream(res)
        const result  = await dbManager.getCryptoList();
        const cryptoList = result.rows.map( r => new Crypto(r))
        sseStream.broadcast({ data: htmlManager.getCryptoTable(cryptoList)})
        await sseStream.addToRoom(cryptoRoom)
        console.log("Successfully joined cryptoRoom")
    })

    server.get("/transaction-table", async(req, res) => {
        const sseStream = await sseManager.createSSEStream(res)
        const resultT  = await dbManager.getTransactionQueue(user.id);
        const transactionList = resultT.rows.map( r => new Transaction(r))
        sseStream.broadcast({ data: htmlManager.getTransactionTable(transactionList)})
        await sseStream.addToRoom(transactionRoom)
        console.log("Successfully joined transactionRoom")
    })

    server.get("/balance", async(req, res) => {
        const sseStream = await sseManager.createSSEStream(res)
        sseStream.broadcast({ data: user.balance.toString() })
        await sseStream.addToRoom(balanceRoom)
        console.log("Successfully joined balanceRoom")
    })   

    server.post("/sell", async(req) => {
        const data = req.body as {crypto : string, quantity : number}
        const crypto = new Crypto((await dbManager.getCrypto(data.crypto)).rows[0])
        if(data.quantity){
            dbManager.putTransactionInQueue(user, crypto, data.quantity, TransactionType.sell)
        }
        return sendTransactionTable()
    })

    server.post("/buy",async(req) => {
        const data = req.body as {crypto : string, quantity : number}
        const crypto = new Crypto((await dbManager.getCrypto(data.crypto)).rows[0])
        if(data.quantity){
            dbManager.putTransactionInQueue(user, crypto, data.quantity, TransactionType.buy)
        }
        return sendTransactionTable()
    })



    //Json api
    const baseJsonPath = '/api'

    server.get(baseJsonPath+'/crypto', async () => {
    
        return 'pong\n'
    })

    server.get(baseJsonPath+'/transactions', async () => {
    
        return 'pong\n'
    })

    server.post(baseJsonPath+'/transactions', async () => {
    
        return 'pong\n'
    })



    server.listen({ port: 4000, host: '0.0.0.0' }, (err, address) => {
        if (err) {
            console.error(err)
            process.exit(1)
        }
        console.log(`Server listening at ${address}`)
    })

    
})().catch(console.error)

