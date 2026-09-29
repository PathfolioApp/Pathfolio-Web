const assert = require('node:assert/strict');

const baseUrl = process.env.API_URL || 'http://localhost:5000/api';
const uniqueId = Date.now().toString();
const username = `postman_${uniqueId.slice(-10)}`;
const email = `${username}@kiit.ac.in`;
const password = 'TestPassword123';
const newPassword = 'NewTestPassword123';
let cookie = '';

async function request(path, options = {}, includeCookie = true) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (includeCookie && cookie) headers.Cookie = cookie;

  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];

  const body = await response.json();
  return { response, body };
}

function expectStatus(response, expected, label) {
  assert.equal(response.status, expected, `${label}: expected ${expected}, received ${response.status}`);
}

const registrationPayload = (overrides = {}) => ({
  personal: { fullName: 'Automated Test User', age: 21, email, username, ...overrides.personal },
  academic: {
    rollNumber: '23051234',
    department: 'Computer Science & Engineering',
    batchYear: '2023 - 2027',
    ...overrides.academic
  },
  interests: { hobbies: ['Reading'], passions: ['Artificial Intelligence'] },
  achievements: [],
  familyContext: { details: '', consentGiven: false },
  credentials: { password, confirmPassword: password, ...overrides.credentials }
});

async function expectRegistrationRejected(label, overrides) {
  const result = await request('/onboarding/register', {
    method: 'POST',
    body: JSON.stringify(registrationPayload(overrides))
  }, false);
  expectStatus(result.response, 400, label);
  console.log(`PASS ${label}`);
}

async function run() {
  let result = await request('/health');
  expectStatus(result.response, 200, 'health');
  assert.equal(result.body.status, 'healthy');
  console.log('PASS health');

  result = await request('/onboarding/check-username', {
    method: 'POST',
    body: JSON.stringify({ username })
  });
  expectStatus(result.response, 200, 'username check');
  assert.equal(result.body.available, true);
  console.log('PASS username check');

  result = await request('/onboarding/verify-roll-number', {
    method: 'POST',
    body: JSON.stringify({ rollNumber: '23051234' })
  });
  expectStatus(result.response, 200, 'roll number check');
  assert.equal(result.body.valid, true);
  console.log('PASS roll number check');

  await expectRegistrationRejected('missing full name', { personal: { fullName: '' } });
  await expectRegistrationRejected('invalid age', { personal: { age: 14 } });
  await expectRegistrationRejected('invalid institutional email', { personal: { email: 'invalid@example.com' } });
  await expectRegistrationRejected('short password', { credentials: { password: 'short', confirmPassword: 'short' } });
  await expectRegistrationRejected('mismatched passwords', { credentials: { confirmPassword: 'DifferentPassword123' } });

  result = await request('/onboarding/register', {
    method: 'POST',
    body: JSON.stringify(registrationPayload())
  });
  expectStatus(result.response, 201, 'registration');
  assert.ok(result.body.data.id);
  const studentId = result.body.data.id;
  assert.ok(cookie, 'registration did not create a session cookie');
  console.log(`PASS registration (${result.body.data.id})`);

  await expectRegistrationRejected('duplicate email', {
    personal: { email, username: `other_${uniqueId.slice(-8)}` }
  });
  await expectRegistrationRejected('duplicate username', {
    personal: { email: `other_${uniqueId}@kiit.ac.in` }
  });

  result = await request('/auth/me');
  expectStatus(result.response, 200, 'auth me');
  assert.equal(result.body.student.personal.email, email);
  assert.equal(result.body.student.isAdmin, false);
  assert.equal(result.body.student.passwordHash, undefined);
  console.log('PASS auth me');

  result = await request('/admin/me');
  expectStatus(result.response, 403, 'non-admin admin route');
  console.log('PASS non-admin admin route blocked');

  result = await request('/admin/uploads/signature');
  expectStatus(result.response, 403, 'non-admin upload signature');
  console.log('PASS non-admin upload signature blocked');

  result = await request('/opportunities');
  expectStatus(result.response, 200, 'student opportunities');
  assert.ok(Array.isArray(result.body.jobPosts));
  console.log('PASS student opportunities');

  result = await request('/profile');
  expectStatus(result.response, 200, 'profile');
  assert.equal(result.body.student.personal.username, username);
  console.log('PASS profile');

  result = await request('/profile/personal', {
    method: 'PATCH',
    body: JSON.stringify({ fullName: 'Updated Automated User', age: 22 })
  });
  expectStatus(result.response, 200, 'personal profile update');
  assert.equal(result.body.student.personal.fullName, 'Updated Automated User');
  console.log('PASS personal profile update');

  result = await request('/profile/interests', {
    method: 'PATCH',
    body: JSON.stringify({ hobbies: ['Chess', 'Chess', ' Reading '] })
  });
  expectStatus(result.response, 200, 'interests update');
  assert.deepEqual(result.body.student.interests.hobbies, ['Chess', 'Reading']);
  console.log('PASS interests update');

  result = await request('/profile/family-context', {
    method: 'PATCH',
    body: JSON.stringify({ details: 'Private family detail', consentGiven: false })
  });
  expectStatus(result.response, 400, 'family context without consent');
  console.log('PASS family context consent enforcement');

  result = await request('/profile/family-context', {
    method: 'PATCH',
    body: JSON.stringify({ details: 'Private family detail', consentGiven: true })
  });
  expectStatus(result.response, 200, 'family context with consent');
  assert.equal(result.body.student.familyContext.consentGiven, true);
  console.log('PASS family context with consent');

  result = await request('/settings/privacy', {
    method: 'PATCH',
    body: JSON.stringify({ visibility: 'private', fieldVisibility: { interests: 'shareable' } })
  });
  expectStatus(result.response, 200, 'privacy settings update');
  assert.equal(result.body.student.profileSettings.visibility, 'private');
  console.log('PASS privacy settings update');

  result = await request('/profile/academic', {
    method: 'PATCH',
    body: JSON.stringify({ department: '', batchYear: '' })
  });
  expectStatus(result.response, 400, 'invalid academic update');
  console.log('PASS invalid academic update rejected');

  // Valid schooling details update
  result = await request('/profile/academic', {
    method: 'PATCH',
    body: JSON.stringify({
      tenthBoard: 'CBSE',
      tenthSchool: 'Delhi Public School',
      tenthYear: 2020,
      tenthPercentage: 92.5,
      twelfthBoard: 'CBSE',
      twelfthSchool: 'Delhi Public School',
      twelfthYear: 2022,
      twelfthStream: 'Science (PCM)',
      twelfthPercentage: 90.0,
      cgpa: 8.9,
      currentSemester: 6
    })
  });
  expectStatus(result.response, 200, 'academic schooling update');
  assert.equal(result.body.student.academic.tenthBoard, 'CBSE');
  assert.equal(result.body.student.academic.tenthYear, 2020);
  assert.equal(result.body.student.academic.twelfthStream, 'Science (PCM)');
  console.log('PASS academic schooling update');

  // Upload 10th Marksheet PDF
  const testMarksheetBytes = Buffer.from('%PDF-1.4\n%MarksheetTest\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
  const marksheetFormData = new FormData();
  marksheetFormData.append('file', new Blob([testMarksheetBytes], { type: 'application/pdf' }), '10th_marksheet_test.pdf');
  marksheetFormData.append('type', 'tenth_marksheet');

  let docUploadRes = await fetch(`${baseUrl}/profile/academic/documents/upload`, {
    method: 'POST',
    headers: cookie ? { Cookie: cookie } : {},
    body: marksheetFormData,
  });
  expectStatus(docUploadRes, 200, '10th marksheet upload');
  let docUploadBody = await docUploadRes.json();
  assert.ok(docUploadBody.student.academic.tenthMarksheet?.fileId, 'tenth marksheet fileId missing');
  assert.equal(docUploadBody.student.academic.tenthMarksheet?.filename, '10th_marksheet_test.pdf');
  console.log('PASS 10th marksheet pdf upload');

  // Stream 10th Marksheet PDF
  let streamRes = await fetch(`${baseUrl}/profile/academic/documents/tenth_marksheet/file?mode=view`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  expectStatus(streamRes, 200, '10th marksheet pdf stream');
  assert.equal(streamRes.headers.get('content-type'), 'application/pdf');
  console.log('PASS 10th marksheet pdf stream retrieval');

  // Delete 10th Marksheet PDF
  result = await request('/profile/academic/documents/tenth_marksheet', { method: 'DELETE' });
  expectStatus(result.response, 200, '10th marksheet delete');
  assert.equal(result.body.student.academic.tenthMarksheet, undefined);
  console.log('PASS 10th marksheet delete');

  // Add Semester record
  result = await request('/profile/academic/semesters', {
    method: 'POST',
    body: JSON.stringify({ semester: 1, sgpa: 8.85, cgpa: 8.85, academicYear: '2023-2024' })
  });
  expectStatus(result.response, 200, 'add semester record');
  const sem1 = result.body.student.academic.semesters.find(s => s.semester === 1);
  assert.ok(sem1, 'semester 1 record should exist');
  assert.equal(sem1.sgpa, 8.85);
  console.log('PASS add semester record');

  // Upload semester transcript
  const transcriptFormData = new FormData();
  transcriptFormData.append('file', new Blob([testMarksheetBytes], { type: 'application/pdf' }), 'Semester1_Transcript.pdf');
  transcriptFormData.append('type', 'semester_transcript');
  transcriptFormData.append('semester', '1');

  let transUploadRes = await fetch(`${baseUrl}/profile/academic/documents/upload`, {
    method: 'POST',
    headers: cookie ? { Cookie: cookie } : {},
    body: transcriptFormData,
  });
  expectStatus(transUploadRes, 200, 'semester transcript upload');
  let transUploadBody = await transUploadRes.json();
  const semWithTranscript = transUploadBody.student.academic.semesters.find(s => s.semester === 1);
  assert.ok(semWithTranscript.transcript?.fileId, 'semester transcript fileId missing');
  assert.equal(semWithTranscript.transcript?.filename, 'Semester1_Transcript.pdf');
  console.log('PASS semester transcript upload');

  // Stream semester transcript
  let transStreamRes = await fetch(`${baseUrl}/profile/academic/semesters/${semWithTranscript.id}/file?mode=view`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  expectStatus(transStreamRes, 200, 'semester transcript stream');
  assert.equal(transStreamRes.headers.get('content-type'), 'application/pdf');
  console.log('PASS semester transcript stream retrieval');

  // Delete semester
  result = await request(`/profile/academic/semesters/${semWithTranscript.id}`, { method: 'DELETE' });
  expectStatus(result.response, 200, 'delete semester');
  assert.equal(result.body.student.academic.semesters.some(s => s.id === semWithTranscript.id), false);
  console.log('PASS delete semester record');

  result = await request('/profile/achievements', {
    method: 'POST',
    body: JSON.stringify({ title: 'Automated Test Achievement', category: 'Project', year: '2026' })
  });
  expectStatus(result.response, 200, 'achievement create');
  const achievementId = result.body.student.achievements.at(-1).id;
  assert.ok(achievementId);
  console.log('PASS achievement create');

  result = await request(`/profile/achievements/${achievementId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title: 'Updated Automated Achievement' })
  });
  expectStatus(result.response, 200, 'achievement update');
  assert.equal(result.body.student.achievements.at(-1).title, 'Updated Automated Achievement');
  console.log('PASS achievement update');

  result = await request(`/profile/achievements/${achievementId}`, { method: 'DELETE' });
  expectStatus(result.response, 200, 'achievement delete');
  assert.equal(result.body.student.achievements.some(item => item.id === achievementId), false);
  console.log('PASS achievement delete');

  result = await request('/profile/achievements/nonexistent-achievement', { method: 'DELETE' });
  expectStatus(result.response, 404, 'nonexistent achievement delete');
  console.log('PASS nonexistent achievement delete rejected');

  // --- Internship Module Tests (Metadata CRUD, Skills, Cloudflare R2 Certificate Upload & Streaming) ---
  // Rejection on missing required fields
  result = await request('/profile/internships', {
    method: 'POST',
    body: JSON.stringify({ companyName: '', role: 'Software Engineer Intern', startDate: '2025-05-01' })
  });
  expectStatus(result.response, 400, 'internship missing company name rejected');
  console.log('PASS internship missing company name rejected');

  result = await request('/profile/internships', {
    method: 'POST',
    body: JSON.stringify({ companyName: 'Acme Corp', role: '', startDate: '2025-05-01' })
  });
  expectStatus(result.response, 400, 'internship missing role rejected');
  console.log('PASS internship missing role rejected');

  result = await request('/profile/internships', {
    method: 'POST',
    body: JSON.stringify({ companyName: 'Acme Corp', role: 'Software Engineer Intern', startDate: '' })
  });
  expectStatus(result.response, 400, 'internship missing start date rejected');
  console.log('PASS internship missing start date rejected');

  result = await request('/profile/internships', {
    method: 'POST',
    body: JSON.stringify({ companyName: 'Acme Corp', role: 'Software Engineer Intern', startDate: '2025-05-01', currentlyWorking: false, endDate: '' })
  });
  expectStatus(result.response, 400, 'internship missing end date when not currently working rejected');
  console.log('PASS internship missing end date when not currently working rejected');

  result = await request('/profile/internships', {
    method: 'POST',
    body: JSON.stringify({ companyName: 'Acme Corp', role: 'Software Engineer Intern', startDate: '2025-06-01', endDate: '2025-05-01', currentlyWorking: false })
  });
  expectStatus(result.response, 400, 'internship invalid date chronology rejected');
  console.log('PASS internship invalid date chronology rejected');

  // Future end date for completed internship rejected
  result = await request('/profile/internships', {
    method: 'POST',
    body: JSON.stringify({
      companyName: 'Future Corp',
      role: 'Intern',
      startDate: '2025-01-01',
      endDate: '2099-01-01',
      currentlyWorking: false,
    })
  });
  expectStatus(result.response, 400, 'future end date for completed internship rejected');
  console.log('PASS future end date for completed internship rejected');

  // Currently working internship without end date accepted
  result = await request('/profile/internships', {
    method: 'POST',
    body: JSON.stringify({
      companyName: 'Ongoing Tech Lab',
      role: 'Research Fellow Intern',
      startDate: '2026-01-10',
      currentlyWorking: true
    })
  });
  expectStatus(result.response, 200, 'currently working internship without end date');
  const ongoingInternship = result.body.student.internships[0];
  assert.equal(ongoingInternship.currentlyWorking, true);
  assert.equal(ongoingInternship.endDate, '');
  console.log('PASS currently working internship without end date accepted');
  await request(`/profile/internships/${ongoingInternship.id}`, { method: 'DELETE' });

  // Successful creation with rich fields
  result = await request('/profile/internships', {
    method: 'POST',
    body: JSON.stringify({
      companyName: 'Acme Cloud Technologies',
      role: 'Backend Engineering Intern',
      startDate: '2025-05-15',
      endDate: '2025-08-15',
      currentlyWorking: false,
      internshipType: 'Summer Internship',
      workMode: 'Hybrid',
      location: 'Bengaluru, India',
      description: 'Worked on distributed caching layers and high-concurrency microservices.',
      responsibilities: [
        'Built Redis caching middleware reducing response latency by 35%',
        'Integrated Prometheus metrics and Grafana dashboards for cluster monitoring'
      ],
      skills: ['Node.js', 'Redis', 'Docker', 'PostgreSQL'],
      companyWebsite: 'https://acmecloud.example.com',
      projectName: 'Distributed Cache Proxy',
      projectDescription: 'Scalable read-through cache abstraction layer',
      projectUrl: 'https://github.com/example/cache-proxy'
    })
  });
  expectStatus(result.response, 200, 'create internship');
  assert.ok(result.body.student.internships?.length > 0, 'internships array should have entries');
  const createdInternship = result.body.student.internships.at(-1);
  assert.equal(createdInternship.companyName, 'Acme Cloud Technologies');
  assert.equal(createdInternship.role, 'Backend Engineering Intern');
  assert.equal(createdInternship.workMode, 'Hybrid');
  assert.equal(createdInternship.internshipType, 'Summer Internship');
  assert.equal(createdInternship.skills.length, 4);
  assert.equal(createdInternship.responsibilities.length, 2);
  const internshipId = createdInternship.id;
  console.log(`PASS internship created with full metadata (${internshipId})`);

  // Update internship
  result = await request(`/profile/internships/${internshipId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      role: 'Senior Backend Engineering Intern',
      workMode: 'Remote'
    })
  });
  expectStatus(result.response, 200, 'update internship');
  const updatedInternship = result.body.student.internships.find(item => item.id === internshipId);
  assert.equal(updatedInternship.role, 'Senior Backend Engineering Intern');
  assert.equal(updatedInternship.workMode, 'Remote');
  console.log('PASS internship updated');

  // Non-PDF certificate rejection
  const nonPdfFormData = new FormData();
  nonPdfFormData.append('file', new Blob(['image payload'], { type: 'image/png' }), 'cert.png');
  let nonPdfRes = await fetch(`${baseUrl}/profile/internships/${internshipId}/certificate`, {
    method: 'POST',
    headers: cookie ? { Cookie: cookie } : {},
    body: nonPdfFormData,
  });
  expectStatus(nonPdfRes, 400, 'upload non-pdf certificate rejected');
  console.log('PASS non-pdf internship certificate rejected');

  // Certificate upload (Cloudflare R2 simulated/backed)
  const certBytes = Buffer.from('%PDF-1.4\n%InternshipCertificate\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
  const certFormData = new FormData();
  certFormData.append('file', new Blob([certBytes], { type: 'application/pdf' }), 'Acme_Internship_Certificate.pdf');

  let certUploadRes = await fetch(`${baseUrl}/profile/internships/${internshipId}/certificate`, {
    method: 'POST',
    headers: cookie ? { Cookie: cookie } : {},
    body: certFormData,
  });
  expectStatus(certUploadRes, 200, 'upload internship certificate');
  const certUploadBody = await certUploadRes.json();
  const certInternship = certUploadBody.student.internships.find(item => item.id === internshipId);
  assert.ok(certInternship.certificate?.fileUrl, 'internship should have certificate.fileUrl');
  assert.equal(certInternship.certificate.filename, 'Acme_Internship_Certificate.pdf');
  console.log('PASS internship certificate uploaded to R2');

  // Certificate streaming / private access
  let certStreamRes = await fetch(`${baseUrl}/profile/internships/${internshipId}/certificate/file?mode=view`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  expectStatus(certStreamRes, 200, 'stream internship certificate');
  assert.equal(certStreamRes.headers.get('content-type'), 'application/pdf');
  console.log('PASS internship certificate authenticated stream retrieval');

  let certDownloadRes = await fetch(`${baseUrl}/profile/internships/${internshipId}/certificate/file?mode=download`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  expectStatus(certDownloadRes, 200, 'download internship certificate');
  assert.ok(certDownloadRes.headers.get('content-disposition')?.includes('attachment'));
  console.log('PASS internship certificate attachment download header verified');

  // Certificate delete
  result = await request(`/profile/internships/${internshipId}/certificate`, { method: 'DELETE' });
  expectStatus(result.response, 200, 'delete internship certificate');
  const delCertInternship = result.body.student.internships.find(item => item.id === internshipId);
  assert.equal(delCertInternship.certificate, null);
  console.log('PASS internship certificate deleted');

  // Reverse chronological ordering test
  const olderRes = await request('/profile/internships', {
    method: 'POST',
    body: JSON.stringify({
      companyName: 'Beta Labs',
      role: 'Junior Intern',
      startDate: '2024-01-01',
      endDate: '2024-04-01',
      currentlyWorking: false
    })
  });
  expectStatus(olderRes.response, 200, 'create older internship');

  const ongoingRes = await request('/profile/internships', {
    method: 'POST',
    body: JSON.stringify({
      companyName: 'Alpha Research',
      role: 'Lead Researcher',
      startDate: '2026-02-01',
      currentlyWorking: true
    })
  });
  expectStatus(ongoingRes.response, 200, 'create ongoing internship');

  const orderedList = ongoingRes.body.student.internships;
  assert.equal(orderedList[0].companyName, 'Alpha Research', 'ongoing internship must be first');
  assert.equal(orderedList[1].companyName, 'Acme Cloud Technologies', 'more recent completed internship must be second');
  assert.equal(orderedList[2].companyName, 'Beta Labs', 'older completed internship must be third');
  console.log('PASS internships returned in reverse chronological order');

  await request(`/profile/internships/${orderedList[0].id}`, { method: 'DELETE' });
  await request(`/profile/internships/${orderedList[2].id}`, { method: 'DELETE' });

  // Delete internship record
  result = await request(`/profile/internships/${internshipId}`, { method: 'DELETE' });
  expectStatus(result.response, 200, 'delete internship');
  assert.equal(result.body.student.internships.some(item => item.id === internshipId), false);
  console.log('PASS internship deleted successfully');

  result = await request('/profile/internships/nonexistent_internship_id', { method: 'DELETE' });
  expectStatus(result.response, 404, 'nonexistent internship delete');
  console.log('PASS nonexistent internship delete rejected');


  // --- Resume Module Tests (PDF Upload, Streaming & Role Tags) ---
  result = await request('/resumes');
  expectStatus(result.response, 200, 'list resumes initially');
  assert.ok(Array.isArray(result.body), 'resumes should return an array');
  console.log('PASS list resumes initially');

  // Empty upload rejection
  result = await request('/resumes/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW' },
    body: '------WebKitFormBoundary7MA4YWxkTrZu0gW--'
  });
  expectStatus(result.response, 400, 'resume upload empty');
  console.log('PASS resume upload empty rejected');

  // Valid PDF upload with initial role tags
  const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
  const uploadFormData = new FormData();
  uploadFormData.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), 'Aman_SDE_Resume.pdf');
  uploadFormData.append('tags', JSON.stringify(['SDE', 'Backend']));

  const uploadRawRes = await fetch(`${baseUrl}/resumes/upload`, {
    method: 'POST',
    headers: cookie ? { Cookie: cookie } : {},
    body: uploadFormData,
  });
  expectStatus(uploadRawRes, 201, 'resume pdf upload with role tags');
  const uploadedResume = await uploadRawRes.json();
  assert.ok(uploadedResume.id, 'uploaded resume should have an ID');
  assert.equal(uploadedResume.filename, 'Aman_SDE_Resume.pdf');
  assert.equal(uploadedResume.isDefault, true, 'first uploaded resume should be default');
  assert.deepEqual(uploadedResume.tags, ['SDE', 'Backend']);
  const resumeId = uploadedResume.id;
  console.log('PASS resume pdf upload with role tags');

  // Verify file stream retrieval
  const fileStreamRes = await fetch(`${baseUrl}/resumes/${resumeId}/file?mode=view`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  expectStatus(fileStreamRes, 200, 'resume pdf stream retrieval');
  assert.equal(fileStreamRes.headers.get('content-type'), 'application/pdf');
  console.log('PASS resume pdf stream retrieval');

  // Update role tags
  result = await request(`/resumes/${resumeId}/tags`, {
    method: 'PATCH',
    body: JSON.stringify({ tags: ['SDE', 'Full Stack', 'Cloud'] })
  });
  expectStatus(result.response, 200, 'resume update role tags');
  assert.deepEqual(result.body.tags, ['SDE', 'Full Stack', 'Cloud']);
  console.log('PASS resume update role tags');

  // Rename resume file
  result = await request(`/resumes/${resumeId}/filename`, {
    method: 'PATCH',
    body: JSON.stringify({ filename: 'Aman_FullStack_Resume' })
  });
  expectStatus(result.response, 200, 'resume rename');
  assert.equal(result.body.filename, 'Aman_FullStack_Resume.pdf');
  console.log('PASS resume rename');

  // Delete resume
  result = await request(`/resumes/${resumeId}`, { method: 'DELETE' });
  expectStatus(result.response, 200, 'resume delete');
  assert.equal(result.body.detail, 'Resume deleted');
  console.log('PASS resume delete');

  result = await request(`/resumes/${resumeId}`, { method: 'DELETE' });
  expectStatus(result.response, 404, 'nonexistent resume delete');
  console.log('PASS nonexistent resume delete rejected');

  result = await request('/notifications');
  expectStatus(result.response, 200, 'notifications');
  assert.ok(Array.isArray(result.body.notifications));
  assert.equal(result.body.notifications[0].type, 'account');
  console.log('PASS notifications');

  result = await request('/settings/security/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword: 'WrongPassword123', newPassword })
  });
  expectStatus(result.response, 400, 'wrong current password');
  console.log('PASS wrong current password rejected');

  result = await request('/settings/security/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword: password, newPassword: 'short' })
  });
  expectStatus(result.response, 400, 'short new password');
  console.log('PASS short new password rejected');

  result = await request('/settings/security/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword: password, newPassword })
  });
  expectStatus(result.response, 200, 'password change');
  console.log('PASS password change');

  result = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }, false);
  expectStatus(result.response, 401, 'old password after change');
  console.log('PASS old password rejected after change');

  result = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: newPassword })
  }, false);
  expectStatus(result.response, 200, 'new password login');
  assert.ok(cookie, 'new password login did not create a session cookie');
  console.log('PASS new password login');

  result = await request('/auth/logout', { method: 'POST' });
  expectStatus(result.response, 200, 'logout');
  console.log('PASS logout');

  result = await request('/profile', {}, false);
  expectStatus(result.response, 401, 'unauthenticated profile');
  console.log('PASS unauthenticated profile blocked');

  result = await request('/admin/me', {}, false);
  expectStatus(result.response, 401, 'unauthenticated admin route');
  console.log('PASS unauthenticated admin route blocked');

  result = await request('/admin/uploads/signature', {}, false);
  expectStatus(result.response, 401, 'unauthenticated upload signature');
  console.log('PASS unauthenticated upload signature blocked');

  result = await request('/opportunities', {}, false);
  expectStatus(result.response, 401, 'unauthenticated opportunities');
  console.log('PASS unauthenticated opportunities blocked');

  result = await request('/resumes', {}, false);
  expectStatus(result.response, 401, 'unauthenticated resumes');
  console.log('PASS unauthenticated resumes blocked');

  result = await request('/onboarding/complete', {
    method: 'POST',
    body: JSON.stringify({ studentId })
  }, false);
  expectStatus(result.response, 401, 'unauthenticated onboarding completion');
  console.log('PASS unauthenticated onboarding completion blocked');

  console.log('\nAll smoke tests passed.');
}

run().catch(error => {
  console.error(`\nSMOKE TEST FAILED: ${error.message}`);
  process.exitCode = 1;
});
