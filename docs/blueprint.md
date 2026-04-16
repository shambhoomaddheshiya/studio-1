# **App Name**: FundFlow

## Core Features:

- Secure User Authentication: Enables secure login for administrators and members using Firebase Authentication.
- Member Profile Management: Allows creating, viewing, updating, and deactivating member profiles, storing essential details like ID, name, and contact information in Firestore.
- Monthly Deposit Tracking: System for administrators to log monthly contributions for each member, marking them as paid or pending for the current cycle, stored in Firestore.
- Loan Issuance System: Admin interface to issue new loans, capturing the loan amount, custom interest rate, and loan date for each member, persisting in Firestore.
- Repayment Transaction Entry: Functionality to accurately record member repayments, distinguishing between principal and interest payments, and updating Firestore.
- Comprehensive Member Passbook: A dedicated view for each member to see their full transaction history, including deposits, loans, and repayments, retrieved from Firestore.
- AI-Powered Transaction Comment Assistant: A generative AI tool that suggests relevant and concise comments for various financial transactions (e.g., deposits, loan disbursements, interest payments) to enhance record-keeping efficiency.

## Style Guidelines:

- The chosen light color scheme is clean and professional. The primary color is a deep, stable blue (#295999), conveying trust and reliability. This provides a strong visual anchor for key interactive elements.
- The background color is a very light, almost off-white grey with a hint of blue (#ECEFF3), ensuring excellent readability and a calm, uncluttered visual space.
- An accent color of bright, clean aqua (#39BBDB) is used for calls-to-action and important highlights, providing a refreshing contrast that draws attention without being overpowering.
- Headline and body font: 'Inter' (sans-serif) is selected for its modern, neutral, and highly legible characteristics, suitable for conveying financial information clearly across various screen sizes.
- Utilize a consistent set of crisp, minimalist line icons that align with financial concepts (e.g., money bags, arrows for transactions, user icons) to enhance navigation and data interpretation.
- A responsive, grid-based layout prioritizes clean data presentation, especially for tables and transaction lists, ensuring optimal usability on both desktop and mobile devices. Card-based UI elements will summarize key information.
- Subtle, quick transition animations (e.g., fade-ins for new content, slight scale on button hovers) will provide visual feedback and enhance the user experience without causing distraction.