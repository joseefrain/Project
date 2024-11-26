import mongoose, { Document, Schema } from 'mongoose';
import { IBranchProducts } from '../inventario/Producto.model';

export interface IEntityGeneralInfo {
  department: string;
  country: string;
  address: string;
  name: string;
}

export interface IEntityContactInfo {
  email: string;
  mobilePhone: string;
  telephone: string;
}

interface IEntityCommercialInfo {
  paymentTerm: string;
  seller: string;
}

export interface IEntity extends Document {
  generalInformation: IEntityGeneralInfo;
  contactInformation: IEntityContactInfo;
  commercialInformation: IEntityCommercialInfo;
  type: IEntityType;
  identificationNumber: string;
  state?: IClientState;
  Products?: IBranchProducts[];
  entities?: string;
}

interface IClientState {
  amountReceivable: number;
  advancesReceipts: number;
  advancesDelivered: number;
  amountPayable: number;
}

export type IEntityType = 'customer' | 'supplier';

// Definir el esquema de usuario
export const EntitySchema: Schema<IEntity> = new Schema({
  generalInformation: {
    type: Schema.Types.Mixed,
  },
  contactInformation: {
    type: Schema.Types.Mixed,
  },
  commercialInformation: {
    type: Schema.Types.Mixed,
  },
  type: {
    type: String,
    required: true,
  },
  identificationNumber: {
    type: String,
    required: true,
  },
  state: {
    type: Schema.Types.Mixed,
  },
  Products: {
    type: Schema.Types.Mixed,
  },
  entities: {
    type: Schema.Types.Mixed,
  },
});

export const Entity = mongoose.model<IEntity>('Entidades', EntitySchema);
