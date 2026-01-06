export type Switches = {
    report_SAP: boolean
    completa: boolean
    reduzida: boolean
    diretos: boolean
    indiretos: boolean
    estoques: boolean
}

export type RequestRow = {
    empresa: string
    exercicio: string
    trimestre: string
    campo: string
    fase: string
    status: string
    versao: string
    secao: string
    defprojeto: string
    datainicio: string // ddmmaaaa (como você fazia)
    bidround: string
    rit: boolean
}

export type Paths = {
    path1: string
    path2: string
    path3: string
    path4: string
    path5: string
    path6: string
}