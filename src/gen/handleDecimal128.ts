import mongoose from "mongoose";

const Big = require('big.js');

// Función para sumar con precisión usando big.js
export function sumarDecimal128(decimal1: mongoose.Types.Decimal128, decimal2: mongoose.Types.Decimal128): mongoose.Types.Decimal128 {
    const num1 = new Big(decimal1.toString());
    const num2 = new Big(decimal2.toString());
    
    // Realizar la suma
    const suma = num1.plus(num2);

    // Convertir el resultado de vuelta a Decimal128
    let resultado = new mongoose.Types.Decimal128(suma.toFixed(2));
    return resultado
}

export function restarDecimal128(decimal1: mongoose.Types.Decimal128, decimal2: mongoose.Types.Decimal128): mongoose.Types.Decimal128 {
    const num1 = new Big(decimal1.toString());
    const num2 = new Big(decimal2.toString());
    
    // Realizar la resta
    const resta = num1.minus(num2);

    // Convertir el resultado de vuelta a Decimal128
    let resultado = new mongoose.Types.Decimal128(resta.toFixed(2));
    return resultado
}