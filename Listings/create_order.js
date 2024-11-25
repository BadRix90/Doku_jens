class VonmaehlenOrderCreationClass {

    productCache = {};
    scmProcessFirstStage = "4DA96132-FE35-4602-B92D-FADF82595AF3";

    
    /**
     *
     * @returns {Promise<void>}
     */
    async createOrder() {
        let parentAccountId = this.getParentAccountId();
        let opportunityId = getCurrentEntityId();
        let createdOrders = [];

        
        await showProgressIndicator("Voraussetzungen pruefen....");
        let orders = await retrieveMultipleRecords("salesorder", `?$filter=_opportunityid_value eq ${opportunityId}`);

        if (orders.entities.length > 0) {
            let confirmed = await openConfirmDialog(
                "Es existieren bereits Bestellungen fuer diese Verkaufschance. Moechtest Du dennoch neue Bestellungen anlegen?",
                "Dennoch anlegen",
                "Abbrechen"
            );

            if (!confirmed) {
                closeProgressIndicator();
                return;
            }
        }

        await showProgressIndicator("Verkaufschance speichern....");
        await save();
        await showProgressIndicator("Auftraege anlegen...");

        
        let timeout = setTimeout(() => {
            openAlertDialog("Der Vorgang dauert laenger als erwartet. Vermutlich ist ein Problem aufgetreten. Bitte aktualisiere die Seite, loesche gegebenenfalls unvollstaendig erstellte Bestellungen und stosse die Erstellung neu an. Sollte das Problem weiterhin bestehen, wende dich bitte an die IT-Abteilung.");
        }, 60000);

        try {
            if (!parentAccountId) {
                
                throw Error("Es konnte kein Account gefunden werden.");
            }

            await showProgressIndicator("Daten abrufen...");

            let opportunity = await retrieveRecord("opportunity", opportunityId, "?$expand=cre56_quote_product_1,cre56_quote_product_2,cre56_quote_product_3,cre56_quote_product_4,cre56_quote_product_5");
            let account = await retrieveRecord("account", parentAccountId);
            let priceListId = await this.getPriceListId(account, opportunity);

            if (!priceListId) {
                
                throw new Error("Es konnte keine Preisliste gefunden werden.");
            }

            if (!opportunity["cre56_order_date"]) {
                
                throw new Error("Es wurde kein Auftragsdatum angegeben.");
            }

            if (!opportunity["_ownerid_value"]) {
                
                throw new Error("Es wurde keine Vertriebsverantwortlichkeit angegeben.");
            }

            if (!opportunity["_cre56_scm_owner_value"]) {
                
                throw new Error("Es wurde keine SCM-Verantwortlichkeit angegeben.");
            }

            
            let userId = getUserId();

            if (normalizeId(opportunity["_cre56_scm_owner_value"]) !== userId && normalizeId(opportunity["_cre56_scm_substitution_value"]) !== userId) {
                
                throw new Error("Du bist fuer diesen Vorgang weder der SCM-Verantwortliche noch die Vertretung und kannst daher keine Bestellungen anlegen.");
            }

            for (let i = 1; i <= 5; i++) {
                if (!opportunity[`cre56_quote_product_${i}`]) {
                    continue;
                }

                let productNumber = opportunity[`cre56_quote_product_${i}`]["dyn365bc_no"];

                showProgressIndicator(`Bestellung fuer Produkt ${productNumber} anlegen...`);

                let orderBaseData = {
                    "name": `${opportunity["nps_id"]} | ${i} | ${productNumber} | ${opportunity[`cre56_logo_name_${i}`]}`,
                    "customerid_account@odata.bind": "/accounts(" + account["accountid"] + ")",
                };

                let mainSalesOrderData = Object.assign({}, orderBaseData);

                if (opportunity["cre56_ship_to_different_address"]) {
                    mainSalesOrderData["shipto_contactname"] = opportunity["cre56_ship_to_contact_name"]
                    mainSalesOrderData["shipto_name"] = opportunity["cre56_ship_to_address_name"]
                    mainSalesOrderData["shipto_line1"] = opportunity["cre56_ship_to_address_line_1"]
                    mainSalesOrderData["shipto_line2"] = opportunity["cre56_ship_to_address_line_2"]
                    mainSalesOrderData["shipto_city"] = opportunity["cre56_ship_to_city"]
                    mainSalesOrderData["shipto_country"] = opportunity["cre56_ship_to_country"]
                    mainSalesOrderData["shipto_postalcode"] = opportunity["cre56_ship_to_post_code"]
                    mainSalesOrderData["cre56_different_ship_to_address"] = opportunity["cre56_ship_to_different_address"]
                }

                if (opportunity["cre56_different_bill_to_address"]) {
                    mainSalesOrderData["billto_name"] = opportunity["cre56_bill_to_name_1"];
                }

                let shipToCountry = opportunity["cre56_ship_to_country"];
                let customsDeclarationRequired = (netGoodsValue > 1000) && !isEU(shipToCountry);

                if (!opportunity["cre56_different_archive_sample_address"]) {
                    quantity = quantity + archiveSampleQuantity;
                }

                
                let mainSalesLines = [
                    this.makeSalesLine(account, null, productNumber, quantity, pricePerUnit, discountPercentage),
                    color ? this.makeAnnotationLine(null, `Farbe: ${color}`) : null,
                    logo ? this.makeAnnotationLine(null, `Logo: ${logo}`) : null,
                    this.makeSalesLine(account, null, 'SER00013', 1, preparationCostPrice, preparationCostDiscount),
                    opportunity["cre56_express"] ? this.makeSalesLine(account, null, 'SER00024', 1, 1) : null,
                    opportunity["cre56_coo_required"] ? this.makeSalesLine(account, null, 'SER00014', 1) : null,
                    customsDeclarationRequired ? this.makeSalesLine(account, null, 'SER00015', 1, customsDeclarationCostPrice, opportunity["cre56_customs_cleareance_discount"]) : null,
                    freightCost !== null ? this.makeSalesLine(account, null, 'SER00016', 1, freightCost, freightCostDiscount) : null,
                ];

                
                for (let j = 1; j <= 3; j++) {
                    let serviceDescription = opportunity[`cre56_service_position_${j}_description_${i}`];
                    let serviceQuantity = opportunity[`cre56_service_position_${j}_quantity_${i}`];
                    let servicePrice = opportunity[`cre56_service_position_${j}_price_${i}`];
                    let serviceDiscount = opportunity[`cre56_service_position_${j}_discount_${i}`];

                    if (serviceDescription && serviceQuantity && servicePrice) {
                        mainSalesLines.push(this.makeSalesLine(account, null, 'SER00017', serviceQuantity, servicePrice, serviceDiscount, null, serviceDescription));
                    }
                }

                createdOrders.push(await this.postOrder(mainSalesOrderData, mainSalesLines));

                if (opportunity['cre56_approval_sample_required']) {
                    let approvalSampleSalesOrderData = Object.assign({}, orderBaseData);
                    approvalSampleSalesOrderData["name"] += ' | Freigabemuster';

                    if (opportunity['cre56_different_approval_sample_address']) {
                        approvalSampleSalesOrderData["shipto_name"] = opportunity["cre56_approval_sample_to_name_1"]
                        approvalSampleSalesOrderData["cre56_different_ship_to_address"] = true;
                    }

                    createdOrders.push(await this.postOrder(approvalSampleSalesOrderData, [
                        this.makeSalesLine(account, null, productNumber, 1, pricePerUnit, 100)
                    ]));
                }

                if (opportunity['cre56_different_archive_sample_to_address'] && archiveSampleQuantity > 0) {
                    let archiveSampleSalesOrderData = Object.assign({}, orderBaseData);

                    archiveSampleSalesOrderData["name"] += ' | Belegmuster';
                    archiveSampleSalesOrderData["cre56_different_ship_to_address"] = true;

                    createdOrders.push(await this.postOrder(archiveSampleSalesOrderData, [
                        this.makeSalesLine(account, null, productNumber, archiveSampleQuantity, pricePerUnit, discountPercentage)
                    ]));
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));

            
            if (getCurrentProcessStageId() === this.scmProcessFirstStage) {
                await nextProcessStage();
            }

            focusTab("tab_orders");
            refreshControl("subgrid_orders");
        } catch (err) {
            await openErrorDialog("Es ist ein Fehler aufgetreten: " + err.message, err);
            closeProgressIndicator();
            clearTimeout(timeout);
            return;
        }

        closeProgressIndicator();
        clearTimeout(timeout);

        let confirmed = await openConfirmDialog("Moechtest Du die Bestellungen direkt in Business Central uebertragen und oeffnen?", "uebertragen und oeffnen", "Schliessen");

        if (confirmed) {
            showProgressIndicator("Bestellungen uebertragen...");
            for (let order of createdOrders) {
                await updateRecord("salesorder", order.salesOrder.id, {statecode: 1});
            }

            showProgressIndicator("Bestellungen oeffnen...");
            await new Promise(r => setTimeout(r, 1000));
            for (let order of createdOrders) {
                let url = await getEntityBCUrl("salesorder", order.salesOrder.id);
                window.open(url, "_blank");
            }
            closeProgressIndicator();
        }
    }
}
export {VonmaehlenOrderCreationClass};