# **📌 Web App Improvement & Feature Request Document**

## **1. General UI/UX Improvements**

* Fix the **color palette** for consistency and accessibility.
* Adjust **font sizes** across the system (currently too small).
* Fix **mobile responsiveness**:

  * Some elements/text are overlapping or clipping.
* Organize the **sidebar** based on purpose or create more logical categories.

---

## **2. Access Control & Permissions**

* A new file **`permissions.tsx`** has been added.
  ➜ Implement **role-based access control** using this instead of manually configuring per page.

---

## **3. Dashboard Improvements**

* Add **pending tasks / notifications functionality**.
* Add more **dashboard cards** depending on the user’s role.
* Add a card or chart showing **incidents / breakages per employee**.

---

## **4. Incident Reports Module**

### **4.1 Filters & Sorting**

* Add filters for incident reports:

  * Date
  * Time
  * Category
  * Status

### **4.2 Categories**

* Add more incident categories:

  * Equipment Damage
  * Others as needed

### **4.3 Charts & Insights**

* Provide a chart showing **incident/breakage count per employee**.

---

## **5. Labor Cost Module**

* Add filters for viewing by time range: **3 / 6 / 9 / 12 months**.
* Fix the **x-axis chronological order** in the graph.

---

## **6. Shift Management Module**

* Convert the UI into a proper **tabular layout**.
* Show how many **employees are assigned per shift**.
* When assigning a shift, **auto-populate the end time** based on a 9-hour shift default.
* Add filters such as:

  * Shift type
  * Date
  * Department
* When clocking in/out, also **capture the employee’s location**.

---

## **7. User Management**

* When creating users, **auto-generate a username** based on First Name + Last Name.
* Add **password strength indicator**.

---

## **8. Payslip System**

* Fix toast behavior so it doesn't reset form inputs or page state.
* Add a **quick actions menu** based on role:

  * Example: Payroll Officer → “Generate Payslip”
* Notify the payslip recipient when:

  * A payslip is generated
  * A payslip is edited (include change summary similar to Git diff)
* Add option to separate **backend and frontend** into dedicated pages/files.
* Add comments/documentation for backend functions.

---

## **9. Notifications System**

* Add notifications for:

  * New payslip received
  * Payslip updates
  * Pending tasks
  * Other system alerts (role-based)

---

## **10. Settings Page**

* Add a **Settings** page for managing:

  * User profile
  * Theme / appearance

---

## **11. Additional Technical Notes**

* Clean up state management so toast or modals **don’t reset page state** unintentionally.
* Ensure all major modules follow the new **permissions.tsx** system.

---
