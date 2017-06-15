﻿import { QueryParameter } from '../constants/query-parameter';

import { DataStoreType } from '../enums/data-store-type';

import { ActionResponse } from '../models/action-response';
import { D365Organization } from '../models/d365-organization';
import { MsCrmOrganization } from '../models/ms-crm-organization';

import { AzureLogin } from './azure-login';

export class MsCrmLogin extends AzureLogin {
    d365OnPremiseOrganizationName: string = '';
    d365OnPremiseUrl: string = '';
    d365OrganizationId: string = '';
    d365Organizations: D365Organization[] = [];
    d365Password: string = '';
    d365Username: string = '';
    entities: string = '';
    isScribe: boolean = false;
    msCrmOrganizationId: string = '';
    msCrmOrganizations: MsCrmOrganization[] = [];
    showAzureTrial: boolean = false;

    async d365Login(): Promise<void> {
        var response = await this.MS.HttpService.executeAsync('Microsoft-CrmGetOrgs');
        if (response.IsSuccess) {
            this.msCrmOrganizations = JSON.parse(response.Body.value);

            if (this.msCrmOrganizations.length > 0) {
                this.msCrmOrganizationId = this.msCrmOrganizations[0].OrganizationId;

                let subscriptions: ActionResponse = await this.MS.HttpService.executeAsync('Microsoft-GetAzureSubscriptions');
                if (subscriptions.IsSuccess) {
                    this.subscriptionsList = subscriptions.Body.value;
                    if (!this.subscriptionsList || (this.subscriptionsList && this.subscriptionsList.length === 0)) {
                        this.MS.ErrorService.message = this.MS.Translate.AZURE_LOGIN_SUBSCRIPTION_ERROR_CRM;
                        this.showAzureTrial = true;
                    } else {
                        this.selectedSubscriptionId = this.subscriptionsList[0].SubscriptionId;
                        this.showPricingConfirmation = true;
                        this.isValidated = true;
                        this.showValidation = true;
                    }
                }
            } else {
                this.MS.ErrorService.message = this.MS.Translate.MSCRM_LOGIN_NO_AUTHORIZATION;
            }
        } else {
            this.MS.ErrorService.message = this.MS.Translate.MSCRM_LOGIN_NO_ORGANIZATIONS;
        }
    }

    async onLoaded(): Promise<void> {
        this.onInvalidate();

        this.showAzureTrial = false;
        this.showValidation = false;

        if (!this.isScribe) {
            if (this.subscriptionsList.length > 0 && this.msCrmOrganizations.length > 0) {
                this.isValidated = true;
                this.showValidation = true;
            } else {
                let queryParam = this.MS.UtilityService.getItem('queryUrl');
                if (queryParam) {
                    let token = this.MS.UtilityService.getQueryParameterFromUrl(QueryParameter.CODE, queryParam);
                    if (token === '') {
                        this.MS.ErrorService.message = this.MS.Translate.MSCRM_LOGIN_ERROR;
                        this.MS.ErrorService.details = this.MS.UtilityService.getQueryParameterFromUrl(QueryParameter.ERRORDESCRIPTION, queryParam);
                        this.MS.ErrorService.showContactUs = true;
                    } else {
                        if (await this.MS.HttpService.isExecuteSuccessAsync('Microsoft-GetAzureToken', { code: token, oauthType: this.oauthType })) {
                            await this.d365Login();
                        }
                    }
                }
                this.MS.UtilityService.removeItem('queryUrl');
            }
        }
    }

    async onValidate(): Promise<boolean> {
        this.onInvalidate();

        this.MS.DataStore.addToDataStore('D365Username', this.d365Username, DataStoreType.Private);
        this.MS.DataStore.addToDataStore('D365Password', this.d365Password, DataStoreType.Private);

        if (!this.d365OnPremiseOrganizationName && !this.d365OnPremiseUrl) {
            let response: ActionResponse = await this.MS.HttpService.executeAsync('Microsoft-GetD365Organizations');

            if (response.IsSuccess) {
                this.d365Organizations = JSON.parse(response.Body.value);

                if (this.d365Organizations && this.d365Organizations.length > 0) {
                    this.d365OrganizationId = this.d365Organizations[0].Id;

                    this.isValidated = true;
                    this.showValidation = true;
                }
            }
        } else {
            this.isValidated = true;
            this.showValidation = true;
        }

        return this.isValidated;
    }

    async connect(): Promise<void> {
        this.MS.DataStore.addToDataStore('AADTenant', 'common', DataStoreType.Public);
        let response: ActionResponse = await this.MS.HttpService.executeAsync('Microsoft-GetAzureAuthUri', { oauthType: this.oauthType });
        window.location.href = response.Body.value;
    }

    async onNavigatingNext(): Promise<boolean> {
        let isSuccess: boolean = true;

        this.MS.DataStore.addToDataStore('Entities', this.entities, DataStoreType.Public);

        if (this.isScribe) {
            if (!this.d365OnPremiseOrganizationName && !this.d365OnPremiseUrl) {
                let d365Organization: D365Organization = this.d365Organizations.find(x => x.Id === this.d365OrganizationId);
                this.MS.DataStore.addToDataStore('ConnectorUrl', d365Organization.ConnectorUrl, DataStoreType.Private);
                this.MS.DataStore.addToDataStore('OrganizationName', d365Organization.Name, DataStoreType.Private);
                this.MS.DataStore.addToDataStore('ScribeDeploymentType', 'Online', DataStoreType.Private);
            } else {
                this.MS.DataStore.addToDataStore('ConnectorUrl', this.d365OnPremiseUrl, DataStoreType.Private);
                this.MS.DataStore.addToDataStore('OrganizationName', this.d365OnPremiseOrganizationName, DataStoreType.Private);
                this.MS.DataStore.addToDataStore('ScribeDeploymentType', 'OnPremise', DataStoreType.Private);
            }
        } else {
            let msCrmOrganization: MsCrmOrganization = this.msCrmOrganizations.find(o => o.OrganizationId === this.msCrmOrganizationId);

            if (msCrmOrganization) {
                this.MS.DataStore.addToDataStore('OrganizationId', msCrmOrganization.OrganizationId, DataStoreType.Public);
                this.MS.DataStore.addToDataStore('OrganizationName', msCrmOrganization.OrganizationName, DataStoreType.Public);
                this.MS.DataStore.addToDataStore('OrganizationUrl', msCrmOrganization.OrganizationUrl, DataStoreType.Public);

                isSuccess = await this.MS.HttpService.isExecuteSuccessAsync('Microsoft-CrmGetOrganization');

                if (isSuccess) {
                    let subscriptionObject = this.subscriptionsList.find(x => x.SubscriptionId === this.selectedSubscriptionId);
                    this.MS.DataStore.addToDataStore('SelectedSubscription', subscriptionObject, DataStoreType.Public);
                    this.MS.DataStore.addToDataStore('SelectedResourceGroup', this.selectedResourceGroup, DataStoreType.Public);

                    let locationsResponse: ActionResponse = await this.MS.HttpService.executeAsync('Microsoft-GetLocations');
                    if (locationsResponse.IsSuccess) {
                        this.MS.DataStore.addToDataStore('SelectedLocation', locationsResponse.Body.value[5], DataStoreType.Public);
                    }

                    isSuccess = await this.MS.HttpService.isExecuteSuccessAsync('Microsoft-CreateResourceGroup');

                    for (let i = 0; i < this.azureProviders.length && isSuccess; i++) {
                        isSuccess = await this.MS.HttpService.isExecuteSuccessAsync('Microsoft-RegisterProvider', { AzureProvider: this.azureProviders[i] });
                    }
                }
            }
        }

        return isSuccess;
    }
}