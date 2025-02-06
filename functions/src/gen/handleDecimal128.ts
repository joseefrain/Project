import mongoose, {Types } from "mongoose";
import Big from 'big.js';

export let cero128 = new mongoose.Types.Decimal128('0.00');

export const formatObejectId = (id: any): mongoose.Types.ObjectId => {
  return new mongoose.Types.ObjectId(id.toString());
}

export const formatDecimal128 = (decimal: any): Types.Decimal128 => {
  return new Types.Decimal128(decimal.toString())
}

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
    let resultado = new mongoose.Types.Decimal128(resta.abs().toFixed(2));
    return resultado
}

export function restarDecimal1282(decimal1: mongoose.Types.Decimal128, decimal2: mongoose.Types.Decimal128): mongoose.Types.Decimal128 {
  const num1 = new Big(decimal1.toString());
  const num2 = new Big(decimal2.toString());
  
  // Realizar la resta
  const resta = num1.minus(num2);

  // Convertir el resultado de vuelta a Decimal128
  let resultado = new mongoose.Types.Decimal128(resta.abs().toFixed(2));
  return resultado
}

export const multiplicarDecimal128 = (decimal1: mongoose.Types.Decimal128, decimal2: mongoose.Types.Decimal128): mongoose.Types.Decimal128 => {
    const num1 = new Big(decimal1.toString());
    const num2 = new Big(decimal2.toString());
    
    // Realizar la resta
    const resta = num1.times(num2);

    // Convertir el resultado de vuelta a Decimal128
    let resultado = new mongoose.Types.Decimal128(resta.toFixed(2));
    return resultado
}

export const dividirDecimal128 = (decimal1: mongoose.Types.Decimal128, decimal2: mongoose.Types.Decimal128): mongoose.Types.Decimal128 => {
    const num1 = new Big(decimal1.toString());
    const num2 = new Big(decimal2.toString());
    
    // Realizar la resta
    const resta = num1.div(num2);

    // Convertir el resultado de vuelta a Decimal128
    let resultado = new mongoose.Types.Decimal128(resta.toFixed(2));
    return resultado
}

export function compareDecimal128(decimalA: mongoose.Types.Decimal128, decimalB: mongoose.Types.Decimal128): boolean {
  const bigA = new Big(decimalA.toString());
  const bigB = new Big(decimalB.toString());

  if (bigA.gt(bigB)) return true;
  if (bigA.lt(bigB)) return false;
  return false;
}

export function compareToCero(decimal: mongoose.Types.Decimal128): boolean {
  
  return decimal.toString() === "0" || decimal.toString() === "0.00" || decimal.toString() === "0.0"
}