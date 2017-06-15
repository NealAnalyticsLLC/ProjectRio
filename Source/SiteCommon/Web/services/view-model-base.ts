﻿/// <reference path="../../../Site/Microsoft.Deployment.Site.Web/typings/index.d.ts" />

import { activationStrategy } from 'aurelia-router';

import { InitParser } from '../classes/init-parser';

import { DataStoreType } from '../enums/data-store-type';

import { MainService } from './main-service';

export class ViewModelBase {
    isActivated: boolean = false;
    isAuthenticated: boolean = true;
    isValidated: boolean = false;
    MS: MainService;
    navigationMessage: string = '';
    onNext: any[] = [];
    onValidateActions: any[] = [];
    showValidation: boolean = false;
    showValidationDetails: boolean = false;
    textNext: string = 'Next';
    useDefaultValidateButton: boolean = false;
    validationText: string = '';
    viewmodel: ViewModelBase;

    constructor() {
        this.MS = (<any>window).MainService;
        this.viewmodel = this;
    }

    async activate(): Promise<void> {
        this.MS.NavigationService.Activate();

        this.isActivated = false;
        this.MS.UtilityService.saveItem('Current Page', window.location.href);
        let currentRoute = this.MS.NavigationService.getCurrentSelectedPage().RoutePageName.toLowerCase();
        this.MS.UtilityService.saveItem('Current Route', currentRoute);
        let viewmodelPreviousSave = window.sessionStorage.getItem(currentRoute);

        if (viewmodelPreviousSave) {
            let jsonParsed = JSON.parse(viewmodelPreviousSave);
            for (let propertyName in jsonParsed) {
                (<any>this)[propertyName] = jsonParsed[propertyName];
            }
            this.viewmodel = this;
            this.viewmodel.MS = (<any>window).MainService;
        }

        this.loadParameters();

        this.MS.NavigationService.currentViewModel = this;
        this.isActivated = true;
    }

    async attached(): Promise<void> {
        await this.onLoaded();
    }

    determineActivationStrategy(): any {
        return activationStrategy.replace;
    }

    loadParameters(): void {
        var parameters = this.MS.NavigationService.getCurrentSelectedPage().Parameters;
        InitParser.loadVariables(this, this.MS.UtilityService.clone(parameters), this.MS, this);
    }

    navigateBack(): void {
        if (!this.MS.NavigationService.isCurrentlyNavigating) {
            this.MS.NavigationService.isCurrentlyNavigating = true;
            let currentRoute = this.MS.NavigationService.getCurrentSelectedPage().RoutePageName.toLowerCase();

            let viewmodelPreviousSave = window.sessionStorage.getItem(currentRoute);
            if (viewmodelPreviousSave) {
                window.sessionStorage.removeItem(currentRoute);
            }

            window.sessionStorage.setItem(currentRoute, JSON.stringify(this.saveViewModel()));

            this.MS.NavigationService.navigateBack();
            this.MS.ErrorService.clear();
            this.MS.NavigationService.isCurrentlyNavigating = false;
            this.verifyNavigation();
        }
    }

    async navigateNext(): Promise<void> {
        if (!this.MS.NavigationService.isCurrentlyNavigating) {
            try {
                this.isValidated = false;
                this.MS.NavigationService.isCurrentlyNavigating = true;
                let isNavigationSuccessful: boolean = await this.onNavigatingNext();
                let isExtendedNavigationSuccessful: boolean = false;
                if (isNavigationSuccessful) {
                    isExtendedNavigationSuccessful = await InitParser.executeActions(this.onNext, this);
                }
                this.navigationMessage = '';
                if (isNavigationSuccessful && isExtendedNavigationSuccessful) {
                    let currentRoute = this.MS.NavigationService.getCurrentSelectedPage().RoutePageName.toLowerCase();
                    let viewmodelPreviousSave = window.sessionStorage.getItem(currentRoute);

                    if (viewmodelPreviousSave) {
                        window.sessionStorage.removeItem(currentRoute);
                    }

                    window.sessionStorage.setItem(currentRoute, JSON.stringify(this.saveViewModel()));
                    this.MS.NavigationService.navigateNext();
                    this.isValidated = true;
                }
            } catch (e) {
            } finally {
                this.MS.NavigationService.isCurrentlyNavigating = false;
                this.MS.DataStore.addToDataStore('HasNavigated', true, DataStoreType.Public);
                if (this.isValidated) {
                    this.verifyNavigation();
                }
            }
        }
    }

    onInvalidate(): void {
        this.isValidated = false;
        this.showValidation = false;
        this.validationText = null;
        this.MS.ErrorService.clear();
    }

    async onLoaded(): Promise<void> {
        this.isValidated = false;
    }

    async onNavigatingNext(): Promise<boolean> {
        return true;
    }

    async onValidate(): Promise<boolean> {
        if (!this.isValidated) {
            this.showValidation = true;
            return false;
        }

        this.isValidated = false;
        this.showValidation = false;
        this.MS.ErrorService.clear();
        this.isValidated = await InitParser.executeActions(this.onValidateActions, this);
        this.showValidation = true;
        return this.isValidated;
    }

    saveViewModel(): any {
        let cleanedViewModel: any = {};
        let vmKeys: string[] = Object.keys(this);
        for (let i = 0; i < vmKeys.length; i++) {
            let vmKey: string = vmKeys[i];
            if (this.hasOwnProperty(vmKey) && vmKey !== 'MS' && vmKey !== 'viewmodel') {
                cleanedViewModel[vmKey] = (<any>this)[vmKey];
            }
        }
        return cleanedViewModel;
    }

    verifyNavigation(): void {
        if (this.MS.UtilityService.isEdge()) {
            this.MS.UtilityService.reload();
        }
    }
}