import mongoose, { Document, Schema } from 'mongoose';
import { IBranchProducts } from '../inventario/Producto.model';

export interface IEntityGeneralInfo {
  department: string;
  country: string;
  address: string;
  name: string;
  identificationNumber: string;
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
  state?: IClientState;
  Products?: IBranchProducts[];
  entities?: string;
}

interface IClientState {
  amountReceivable: mongoose.Types.Decimal128;
  advancesReceipts: mongoose.Types.Decimal128;
  advancesDelivered: mongoose.Types.Decimal128;
  amountPayable: mongoose.Types.Decimal128;
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
