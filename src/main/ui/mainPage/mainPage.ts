import { getTrasactionForm } from "../transactionForm/transactionForm";
import { Crypto } from "../../entity/crypto";
import { getUser } from "../user/user";
import { User } from "../../entity/user";
import { Transaction } from "../../entity/transaction";

export function getMainPage (cryptoList : Crypto[], user : User) : string{
    return /*html*/`
    <!doctype html>
    <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://cdn.tailwindcss.com"></script>
            <script src="https://unpkg.com/htmx.org@1.9.12"></script>
            <script src="https://unpkg.com/htmx.org@1.9.12/dist/ext/sse.js"></script>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap" rel="stylesheet">
        </head>
        <body class='h-screen bg-gray-100' style='font-family:Roboto,sans-serif'>
            <div class='h-full p-5 grid grid-cols-2 gap-5'>
                <div class='h-full p-5  border bg-white border-white rounded-2xl' hx-ext="sse" sse-connect="/crypto-list" sse-swap="message"> 
                    
                </div>
                <div class='h-full'>
                    <div class=' px-8 py-3 font-bold border bg-white border-white rounded-2xl'>
                        ${getUser(user)}
                    </div>
                    <div class='p-5  border bg-white border-white rounded-2xl flex flex-col'>
                        ${getTrasactionForm(cryptoList)}
                    </div>
                    <div id='transactionTable' 
                        class='overflow-y-auto h-80 p-5 border bg-white  border-white rounded-2xl flex flex-col'
                        hx-ext="sse" sse-connect="/transaction-table" sse-swap="message"
                    >
                    </div>
                </div>
            </div>
        </body>
    </html>      
    `
}