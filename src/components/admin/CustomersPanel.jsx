import { useState } from "react";
import { styles } from "./adminStyles";
import CustomerList from "./customer/CustomerList";
import CustomerDetails from "./customer/CustomerDetails";
import PermissionGate from "./common/PermissionGate";
import { ADMIN_PERMISSIONS } from "../../utils/adminPermissions";

export default function CustomersPanel({
  customerFilter,
  onCustomerFilterChange,
  filteredCustomers,
  customerSort,
  customerReservations,
  customerActions,
  contactActions,
  onCustomerSort,
  onOpenCommunication,
  permissions,
}) {
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const selectedCustomerFromList = selectedCustomer
    ? filteredCustomers.find((customer) => customer.id === selectedCustomer.id) || selectedCustomer
    : null;

  const selectedCustomerReservations = selectedCustomerFromList
    ? customerReservations.get(selectedCustomerFromList.id) || []
    : [];

  function openCustomerDetails(customer) {
    setSelectedCustomer(customer);
  }

  function closeCustomerDetails() {
    setSelectedCustomer(null);
  }

  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <div>
          <h2 style={styles.panelTitle}>Clients {customerFilter === "loyal" ? "fidèles" : ""}</h2>
          <p style={styles.muted}>La liste sert à retrouver un client ; la fiche client regroupe les informations durables de la personne.</p>
        </div>
        <div style={styles.headerActions}>
          {customerFilter === "loyal" && (
            <button style={styles.smallButton} onClick={() => onCustomerFilterChange("all")}>
              Voir tous les clients
            </button>
          )}
          <PermissionGate permissions={permissions} permission={ADMIN_PERMISSIONS.manageCommunication}>
            <button style={styles.addButton} onClick={() => customerActions.bulkEmail("all")}>Email tous les clients</button>
            <button style={styles.addButton} onClick={() => customerActions.bulkEmail("loyal")}>Email clients fidèles</button>
          </PermissionGate>
          <PermissionGate permissions={permissions} permission={ADMIN_PERMISSIONS.manageCustomers}>
            <button style={styles.addButton} onClick={customerActions.add}>Ajouter client</button>
          </PermissionGate>
        </div>
      </div>

      {selectedCustomerFromList && (
        <CustomerDetails
          customer={selectedCustomerFromList}
          reservations={selectedCustomerReservations}
          customerActions={customerActions}
          contactActions={contactActions}
          onClose={closeCustomerDetails}
          onOpenCommunication={onOpenCommunication}
          permissions={permissions}
        />
      )}

      <CustomerList
        customers={filteredCustomers}
        customerSort={customerSort}
        customerReservations={customerReservations}
        customerActions={customerActions}
        contactActions={contactActions}
        onCustomerSort={onCustomerSort}
        onOpenCustomer={openCustomerDetails}
        selectedCustomerId={selectedCustomerFromList?.id}
      />
    </section>
  );
}
