    /**
     * Get the additional information text
     * @param customer
     * @param opportunity
     * @param product
     * @returns {string}
     */
    getAdditionalInformationText(customer, opportunity, product) {
        let deliveryTime = product["vmCoBrandingDeliveryTime"]
        if (this.getLanguage(customer, opportunity) === "de") {
            if (this.isPrepayment(customer)) {
                return "Lieferbedingungen: Die Lieferung erfolgt ab ${deliveryTime} Wochen nach der Auftragsbestätigung und unter dem Vorbehalt der Freigabe aller produktionsrelevanten Unterlagen. Die Freigabe beinhaltet die Druckfreigabe des Korrekturabzugs sowie den Zahlungseingang.";
            } else {
                return "Lieferbedingungen: Die Lieferung erfolgt ab ${deliveryTime} Wochen nach der Auftragsbestätigung und unter dem Vorbehalt der Freigabe aller produktionsrelevanten Unterlagen.";
            }
        } else {
            if (this.isPrepayment(customer)) {
                return "Terms of delivery: Delivery will be made from ${deliveryTime} weeks after the date of order confirmation depending on the approval of all production-relevant documents. The approval includes the authorisation of the proof and the receipt of payment.";
            } else {
                return "Terms of delivery: Delivery will be made from ${deliveryTime} weeks after the date of order confirmation depending on the approval of all production-relevant documents."
            }
        }
    }

    