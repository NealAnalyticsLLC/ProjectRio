import { DataStoreType } from '../../../../../SiteCommon/Web/enums/data-store-type'

import { ViewModelBase } from '../../../../../SiteCommon/Web/services/view-model-base'

export class SearchTerms extends ViewModelBase {
    searchQuery: string = '';

    async onLoaded(): Promise<void> {
        this.isValidated = false;
    }

    async onValidate(): Promise<boolean> {
        if (this.searchQuery.length > 0) {
            this.isValidated = true;
            this.showValidation = true;
            this.MS.DataStore.addToDataStore('SearchQuery', this.searchQuery, DataStoreType.Public);
        }

        return true;
    }
}