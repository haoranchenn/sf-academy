import { Crypto } from "../../entity/crypto"

export function getTrasactionForm(cryptoList : Crypto[]) : string{
    const html = /*html*/ `       
        <form>
            <div id='selected'>Seleziona una crypto</div>
            <select class='mb-3 block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400'>
                <option></option>
                ${cryptoList.map((crypto) => getOption(crypto)).join('')}
            </select>
            <div id='selected'>Quantità</div>
            <input class='mb-3 block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400' type='number' name='quantity'>
            <div>
                <button hx-post="/buy">Compra</button>
                <button hx-post="/sell">Vendi</button>
            </div>
        </form>
    `

    return html.replace(/(\r\n|\n|\r)/gm, ' ')
}

function getOption(crypto : Crypto) : string {
    return /*html*/`
        <option value='${crypto.id}'>${crypto.name}</option>
    `
}