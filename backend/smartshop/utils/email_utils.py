from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags

from django.conf import settings


def send_html_email(subject, template, context, recipient_list):
    html_content = render_to_string(template, context)
    text_content = strip_tags(html_content)
    msg = EmailMultiAlternatives(subject, text_content, from_email=settings.EMAIL_HOST_USER, to=[recipient_list])
    msg.attach_alternative(html_content, "text/html")
    msg.send()
